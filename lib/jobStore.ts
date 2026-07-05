import type { Job } from "@/types/product";

// Almacén de jobs en memoria. Para producción real (multi-instancia)
// esto debería moverse a Redis o una base de datos.
// TODO: implementar createJob / getJob / updateJob en el siguiente paso.

const jobs = new Map<string, Job>();

export function createJob(id: string, total: number): Job {
  const job: Job = { id, status: "processing", total, processed: 0, products: [] };
  jobs.set(id, job);
  return job;
}

export function getJob(id: string): Job | undefined {
  return jobs.get(id);
}

export function updateJob(id: string, patch: Partial<Job>) {
  const job = jobs.get(id);
  if (!job) return;
  Object.assign(job, patch);
}
