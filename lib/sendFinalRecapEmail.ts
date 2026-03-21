export async function sendFinalRecapEmail(matchId: string) {
  const response = await fetch(`/api/matches/${matchId}/send-final-recap`, {
    method: 'POST',
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error || 'Failed to send final recap email.');
  }

  return response.json().catch(() => null);
}
