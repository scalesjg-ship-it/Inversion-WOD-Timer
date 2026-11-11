import type { BrandColors } from '../types';

export type PageDefaults = {
  gymName: string;
  colors: BrandColors;
};

const CSS = `
:root { color-scheme: dark; }
* { box-sizing: border-box; }
body { margin: 0; background: #07080A; color: #F4F7FB; font: 18px/1.45 system-ui, sans-serif; }
main { max-width: 34rem; margin: 0 auto; padding: 28px 18px 56px; }
h1 { font-size: 34px; line-height: 1.1; margin: 0 0 8px; }
p { color: #93A0B0; margin: 8px 0; }
label, legend { display: block; margin: 18px 0 6px; color: #93A0B0; font-size: 13px; letter-spacing: 0.08em; text-transform: uppercase; }
input, select, button { width: 100%; font: inherit; color: #F4F7FB; background: #141820; border: 1px solid rgba(244,247,251,0.16); border-radius: 14px; padding: 14px; }
input[type="color"] { height: 54px; padding: 8px; }
input[type="file"] { padding: 12px; }
button { background: #FF4D2E; color: #07080A; font-weight: 700; border: 0; margin-top: 20px; }
.check { display: flex; align-items: center; gap: 10px; text-transform: none; letter-spacing: 0; font-size: 17px; color: #F4F7FB; }
.check input { width: auto; }
.colors { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 12px; }
details { margin-top: 8px; }
summary { cursor: pointer; color: #F4F7FB; }
#note { min-height: 1.4em; color: #FFB020; }
`.trim();

export function formPage(token: string, defaults: PageDefaults): string {
  const colors: { name: keyof BrandColors; label: string }[] = [
    { name: 'workColor', label: 'Work' },
    { name: 'restColor', label: 'Rest' },
    { name: 'leadInColor', label: 'Lead-in' },
    { name: 'warningColor', label: 'Warning' },
    { name: 'digitColor', label: 'Digits' },
    { name: 'backgroundColor', label: 'Background' },
    { name: 'uiColor', label: 'Accent' },
  ];
  const colorFields = colors
    .map(
      (color) =>
        `<label>${color.label}<input type="color" name="${color.name}" value="${escapeHtml(defaults.colors[color.name].toLowerCase())}"></label>`,
    )
    .join('');
  return document(
    'Send a logo',
    `<h1>Send a logo</h1>
<p>This page is served by the TV on your Wi-Fi. The photo goes to that TV and is not sent to a server on the internet.</p>
<form method="post" action="/?t=${escapeHtml(token)}" enctype="multipart/form-data">
<input type="hidden" name="t" value="${escapeHtml(token)}">
<label>Logo<input type="file" name="logo" accept="image/jpeg,image/png,image/heic,image/heif,.jpg,.jpeg,.png,.heic,.heif" required></label>
<label>Gym name, optional<input name="gymName" maxlength="48" value="${escapeHtml(defaults.gymName)}" autocomplete="off"></label>
<label>Placement
<select name="placement">
<option value="">Keep current</option>
<option value="watermark">Watermark</option>
<option value="fullBleed">Full bleed</option>
<option value="corner">Corner</option>
</select>
</label>
<details>
<summary>Colors, optional</summary>
<label class="check"><input type="checkbox" name="updateColors" value="on"> Update colors on the TV</label>
<div class="colors">${colorFields}</div>
</details>
<p id="note"></p>
<button type="submit">Send</button>
</form>
<script>
document.querySelector('form').addEventListener('submit', function (event) {
  var input = document.querySelector('input[type=file]');
  var file = input && input.files && input.files[0];
  if (file && file.size > 10485760) {
    event.preventDefault();
    document.getElementById('note').textContent = 'Use a photo under 10 MB.';
  }
});
</script>`,
  );
}

export function messagePage(title: string, message: string): string {
  return document(title, `<h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p>`);
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function document(title: string, body: string): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="referrer" content="no-referrer"><title>${escapeHtml(title)}</title><style>${CSS}</style></head><body><main>${body}</main></body></html>`;
}
