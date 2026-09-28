/** React Query keys — one place so invalidations match. */
export const queryKeys = {
  config: ['config'] as const,
  mandirHome: ['mandir', 'home'] as const,
  deities: ['deities'] as const,
  // Not under ['deities'], so saving the deity list does not refetch every offering list.
  deityOfferings: (deityId: string) => ['offerings', deityId] as const,
  deityAartis: (deityId: string) => ['aartis', deityId] as const,
  aartiLyrics: (aartiId: string, version: number) => ['aarti-lyrics', aartiId, version] as const,
  thalis: ['mandir', 'thalis'] as const,
};
