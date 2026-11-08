export function saveStatus(input: { loading?: boolean; error?: string; saving?: boolean; draft?: boolean }) {
  if (input.error) return { label: input.error, icon: 'alert' as const, error: true };
  return { label: '', icon: 'check' as const, error: false };
}
