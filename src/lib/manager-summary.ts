export type ManagerJob = { id:string; title:string; startTime:string; driver:string; plate:string; status:string };
export type JobFilter = "all" | "attention" | "active" | "completed";
export function needsAssignment(job:ManagerJob) {
  return !["completed","cancelled"].includes(job.status) && (!job.driver?.trim() || job.driver === "-" || !job.plate?.trim() || job.plate === "-");
}
export function summarizeJobs(jobs:ManagerJob[]) {
  return {attention:jobs.filter(needsAssignment).length, active:jobs.filter(j=>j.status==="active").length, completed:jobs.filter(j=>j.status==="completed").length, planned:jobs.filter(j=>j.status==="planned").length};
}
export function filterJobs(jobs:ManagerJob[],filter:JobFilter) {
  return jobs.filter(j=>filter==="all" || (filter==="attention"?needsAssignment(j):j.status===filter));
}
