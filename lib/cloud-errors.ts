const resolveDebugFlag = () => {
  if (process.env.NEXT_PUBLIC_DEBUG !== undefined) {
    return process.env.NEXT_PUBLIC_DEBUG === 'true';
  }

  if (typeof window === 'undefined') {
    return false;
  }

  return (window as any).NEXT_PUBLIC_DEBUG === 'true';
};

export const isDebugEnabled = () => resolveDebugFlag();

const stringifyError = (error: unknown) => {
  if (!error) return '';
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
};

export const formatCloudError = (fallback: string, error?: unknown) => {
  if (!isDebugEnabled()) return fallback;
  const details = stringifyError(error);
  if (!details) return fallback;
  return `${fallback} (${details})`;
};
