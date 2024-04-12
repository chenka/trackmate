import { Store } from "@tauri-apps/plugin-store"

const store = new Store(".database.dat")

export function generateID() {
  return Math.random().toString(36).substr(2, 9)
}
export type Client = {
  name: string
  id: string
}

export type Project = {
  name: string
  id: string
  billable: boolean
  billableRate: number
  clientId: string | null
}

export type Task = {
  name: string
  id: string
  projectId?: string
  clientId?: string
  startTime: string
  endTime: string
}

export async function createClient(client: Client): Promise<Client> {
  const clients = (await store.get<Client[]>("clients")) || []
  clients.push(client)
  await store.set("clients", clients)
  await store.save()
  return client
}

export async function getClients(): Promise<Client[]> {
  return (await store.get<Client[]>("clients")) || []
}

export async function createProject(project: Project): Promise<Project> {
  const projects = (await store.get<Project[]>("projects")) || []
  projects.push(project)
  await store.set("projects", projects)
  await store.save()
  return project
}

export async function getProjects(): Promise<Project[]> {
  return (await store.get<Project[]>("projects")) || []
}

export async function getTasks(): Promise<Task[]> {
  return (await store.get<Task[]>("tasks")) || []
}

export async function createTask(task: Task): Promise<Task> {
  const tasks = (await store.get<Task[]>("tasks")) || []
  tasks.push(task)
  await store.set("tasks", tasks)
  await store.save()
  return task
}

export async function resetDatabase() {
  await store.clear()
}
