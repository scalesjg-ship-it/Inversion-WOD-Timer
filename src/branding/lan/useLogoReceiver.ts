import { File, Paths } from 'expo-file-system';
import * as Network from 'expo-network';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { prepareLogo } from '../logo';
import type { BrandColors, Branding } from '../types';
import { chooseLanIPv4, pairingUrl } from './address';
import { applyUploadedLogo } from './applyUpload';
import { LanListenerUnavailableError, readRouteLanAddress, startLanServer } from './lanServer';
import { LOGO_LISTEN_MS } from './limits';
import type { ReceiverPhase } from './receiverPhase';
import { LogoTransferSession } from './session';
import { createPairingToken } from './token';

export function useLogoReceiver(
  branding: Branding,
  update: (patch: Partial<Branding>) => Promise<void>,
): { phase: ReceiverPhase; restart: () => void } {
  const [phase, setPhase] = useState<ReceiverPhase>({ kind: 'starting' });
  const [generation, setGeneration] = useState(0);
  const brandingRef = useRef(branding);
  const updateRef = useRef(update);

  useEffect(() => {
    brandingRef.current = branding;
    updateRef.current = update;
  }, [branding, update]);

  useFocusEffect(
    useCallback(() => {
      // `generation` is the restart counter. Reading it ties this listener to that counter.
      if (!Number.isFinite(generation)) return undefined;
      let stopped = false;
      let closeServer = () => {};
      let timer: ReturnType<typeof setTimeout> | undefined;
      const address = { ip: '', port: 0 };
      let rotate = (_next: string) => {};
      const session = new LogoTransferSession(
        createPairingToken(),
        () => stopped,
        () => ({
          gymName: brandingRef.current.gymName,
          colors: colorsOf(brandingRef.current),
        }),
        async (upload) => {
          await applyUploadedLogo(upload, {
            writeTempFile,
            prepareLogo,
            update: (patch) => updateRef.current(patch),
            deleteTempFile,
          });
          const next = createPairingToken();
          rotate(next);
          if (!stopped) setPhase({ kind: 'ready', url: pairingUrl(address.ip, address.port, next), saved: true });
        },
      );
      rotate = (next) => session.rotate(next);

      setPhase({ kind: 'starting' });
      void (async () => {
        try {
          const reported = (await Network.getIpAddressAsync()).trim();
          let ip = chooseLanIPv4([reported]);
          if (!ip) {
            try {
              ip = chooseLanIPv4([await readRouteLanAddress()]);
            } catch {
              ip = null;
            }
          }
          if (stopped) return;
          if (!ip) {
            setPhase({
              kind: 'error',
              message: 'Connect this TV to the same Wi-Fi as the phone, then try again.',
            });
            return;
          }
          const running = await startLanServer(session);
          if (stopped) {
            running.close();
            return;
          }
          closeServer = running.close;
          address.ip = ip;
          address.port = running.port;
          setPhase({ kind: 'ready', url: pairingUrl(ip, running.port, session.token), saved: false });
          timer = setTimeout(() => {
            stopped = true;
            closeServer();
            setPhase({ kind: 'expired' });
          }, LOGO_LISTEN_MS);
        } catch (error) {
          if (!stopped) {
            setPhase({
              kind: 'error',
              message:
                error instanceof LanListenerUnavailableError
                  ? error.message
                  : 'This TV could not open a link on the local network.',
            });
          }
        }
      })();

      return () => {
        stopped = true;
        if (timer) clearTimeout(timer);
        closeServer();
      };
    }, [generation]),
  );

  const restart = useCallback(() => {
    setGeneration((value) => value + 1);
  }, []);

  return { phase, restart };
}

function colorsOf(branding: Branding): BrandColors {
  return {
    workColor: branding.workColor,
    restColor: branding.restColor,
    leadInColor: branding.leadInColor,
    warningColor: branding.warningColor,
    digitColor: branding.digitColor,
    backgroundColor: branding.backgroundColor,
    uiColor: branding.uiColor,
  };
}

async function writeTempFile(name: string, bytes: Uint8Array): Promise<string> {
  const file = new File(Paths.cache, name);
  file.create({ overwrite: true });
  try {
    await file.write(bytes);
  } catch (error) {
    if (file.exists) file.delete();
    throw error;
  }
  return file.uri;
}

async function deleteTempFile(uri: string): Promise<void> {
  const file = new File(uri);
  if (file.exists) file.delete();
}
