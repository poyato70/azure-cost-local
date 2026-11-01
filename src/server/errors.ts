export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function assertActive(signal: AbortSignal) {
  if (signal?.aborted)
    throw new AppError(
      "unauthenticated",
      "Sessão encerrada ou consulta cancelada.",
      401,
    );
}
