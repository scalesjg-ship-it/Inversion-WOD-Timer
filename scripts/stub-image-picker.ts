export async function requestMediaLibraryPermissionsAsync(): Promise<{ granted: boolean }> {
  return { granted: false };
}

export async function launchImageLibraryAsync(): Promise<{ canceled: true }> {
  return { canceled: true };
}
