import { createSignal, onCleanup, For } from "solid-js"
import { TrayIcon } from "@tauri-apps/api/tray"
import {} from "@tauri-apps/api/app"
import {
  Client,
  Project,
  Task,
  createClient,
  createProject,
  createTask,
  generateID,
  getClients,
  getProjects,
  getTasks,
  resetDatabase,
} from "./store"
// Type definitions
type TaskHistoryEntry = {
  id: string
  name: string
  clientName: string
  projectName: string
  duration: string
  startTime: string
  endTime: string
  billable: boolean
  billableRate: number
}

type ReportEntry = {
  clientName: string
  projectName: string
  taskCount: number
  totalDuration: string
  totalAmount: number
}

const formatTime = (time: number): string => {
  const hours = Math.floor(time / 3600)
  const minutes = Math.floor((time % 3600) / 60)
  const seconds = time % 60
  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
}

function App() {
  // State variables
  const [time, setTime] = createSignal<number>(0)
  const [timerId, setTimerId] = createSignal<number | null>(null)
  const [trayIcon, setTrayIcon] = createSignal<null | TrayIcon>(null)
  const [selectedClient, setSelectedClient] = createSignal<string>("")
  const [selectedProject, setSelectedProject] = createSignal<string>("")
  const [taskName, setTaskName] = createSignal<string>("")
  const [currentTask, setCurrentTask] = createSignal<string>("")
  const [startTime, setStartTime] = createSignal<Date>(new Date())
  const [taskHistory, setTaskHistory] = createSignal<Task[]>([])
  const [projects, setProjects] = createSignal<Project[]>([])
  const [clients, setClients] = createSignal<Client[]>([])
  const [newProjectName, setNewProjectName] = createSignal<string>("")
  const [newProjectClientId, setNewProjectClientId] = createSignal<string>("")
  const [newProjectBillable, setNewProjectBillable] =
    createSignal<boolean>(false)
  const [newProjectBillableRate, setNewProjectBillableRate] =
    createSignal<number>(0)
  const [newClientName, setNewClientName] = createSignal<string>("")

  getClients().then((data) => {
    console.log("client", data)
    setClients(data)
  })
  getProjects().then((data) => {
    console.log("projects", data)

    setProjects(data)
  })
  getTasks().then((data) => {
    console.log("tasks", data)
    setTaskHistory(data)
  })

  function getDuration(
    startTime: Date,
    endTime: Date,
    unit: "seconds" | "minutes"
  ): number {
    const duration = (endTime.getTime() - startTime.getTime()) / 1000
    return Math.floor(unit === "seconds" ? duration : duration / 60)
  }

  const formatDuration = (durationInSeconds: number): string => {
    const hours = Math.floor(durationInSeconds / 3600)
    const minutes = Math.floor((durationInSeconds % 3600) / 60)
    const seconds = durationInSeconds % 60
    return `[${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}]`
  }

  const getTaskHisotryEntries = (): TaskHistoryEntry[] => {
    const tasks = taskHistory()
    const taskHistoryEntries: TaskHistoryEntry[] = []
    tasks.forEach((task) => {
      const client = clients().find((c) => c.id === task.clientId)
      const project = projects().find((p) => p.id === task.projectId)

      const duration = formatDuration(
        (new Date(task.endTime).getTime() -
          new Date(task.startTime).getTime()) /
          1000
      )
      taskHistoryEntries.push({
        clientName: client ? client.name : "",
        projectName: project ? project.name : "",
        id: task.id,
        name: task.name,
        duration: duration,
        startTime: task.startTime,
        endTime: task.endTime,
        billable: project?.billable || false,
        billableRate: project?.billableRate || 0,
      })
    })

    return taskHistoryEntries
  }

  // Timer functions
  const startTimer = async (): Promise<void> => {
    await createTrayIconTimer()
    // if (
    //   !selectedClient().trim() ||
    //   !selectedProject().trim() ||
    //   !taskName().trim()
    // ) {
    //   alert("Please select a client and a project, and enter a task name.")
    //   return
    // }
    setCurrentTask(taskName())
    setStartTime(new Date())
    const id = setInterval(() => {
      setTime((prev) => prev + 1)
      const title = `${taskName()} ${formatDuration(time())}`
      trayIcon()?.setTitle(title)
    }, 1000)
    setTimerId(id)
  }

  const stopTimer = async (): Promise<void> => {
    if (trayIcon()) {
      await trayIcon()?.close()
    }
    const duration = time()
    const endTime = new Date(startTime().getTime() + duration * 1000)
    clearInterval(timerId() as number)
    const selectedProjectData = projects().find(
      (project) => project.name === selectedProject()
    )
    await createTask({
      id: generateID(),
      name: currentTask(),
      startTime: startTime().toISOString(),
      endTime: endTime.toISOString(),
      clientId: selectedProjectData?.clientId || "",
      projectId: selectedProjectData?.id || "",
    })
    const tasks = await getTasks()
    setTaskHistory(tasks)
    setTimerId(null)
    setCurrentTask("")
    setTime(0)
  }

  const toggleTimer = (): void => {
    timerId() ? stopTimer() : startTimer()
  }

  const createTrayIconTimer = async (): Promise<void> => {
    const _trayIcon = await TrayIcon.new({
      id: "timer",
      title: "[00:00:00]",
      action: (event) => console.log(event),
    }).catch(console.error)
    if (_trayIcon) {
      setTrayIcon(_trayIcon)
    }
  }

  const handleKeyDown = (e: KeyboardEvent): void => {
    if (e.key === "Enter") {
      toggleTimer()
    }
  }

  // Project and client functions
  const addProject = async (): Promise<void> => {
    if (!newProjectName().trim()) {
      alert("Please enter a project name.")
      return
    }
    const project: Project = {
      name: newProjectName(),
      clientId: newProjectClientId(),
      billable: newProjectBillable(),
      billableRate: newProjectBillableRate(),
      id: generateID(),
    }
    await createProject(project)
    const projectsArray = await getProjects()
    setProjects(projectsArray)

    setNewProjectName("")
    setNewProjectClientId("")
    setNewProjectBillable(false)
    setNewProjectBillableRate(0)
  }

  const addClient = async (): Promise<void> => {
    if (!newClientName().trim()) {
      alert("Please enter a client name.")
      return
    }
    await createClient({ name: newClientName(), id: generateID() })
    const clients = await getClients()
    setClients(clients)
    setNewClientName("")
  }

  // Report generation
  const generateReportData = (): ReportEntry[] => {
    const reportData: ReportEntry[] = []
    const groupedData: {
      [key: string]: { [key: string]: TaskHistoryEntry[] }
    } = {}

    getTaskHisotryEntries().forEach((task) => {
      const clientKey = task.clientName || ""
      const projectKey = task.projectName || ""
      if (!groupedData[clientKey]) {
        groupedData[clientKey] = {}
      }
      if (!groupedData[clientKey][projectKey]) {
        groupedData[clientKey][projectKey] = []
      }
      groupedData[clientKey][projectKey].push(task)
    })

    for (const clientKey in groupedData) {
      for (const projectKey in groupedData[clientKey]) {
        const tasks = groupedData[clientKey][projectKey]
        const taskCount = tasks.length
        const totalDuration = tasks.reduce((sum, task) => {
          const durationMinutes = getDuration(
            new Date(task.startTime),
            new Date(task.endTime),
            "seconds"
          )
          return sum + durationMinutes
        }, 0)

        const totalAmount = tasks.reduce((sum, task) => {
          const billableRate = task ? task.billableRate : 0

          const durationMinutes = getDuration(
            new Date(task.startTime),
            new Date(task.endTime),
            "minutes"
          )
          return sum + billableRate * (durationMinutes / 60)
        }, 0)

        reportData.push({
          clientName: clientKey,
          projectName: projectKey,
          taskCount,
          totalDuration: formatDuration(totalDuration),
          totalAmount: Math.round(totalAmount * 100) / 100,
        })
      }
    }

    return reportData
  }

  // Cleanup timer on component unmount
  onCleanup(() => {
    const id = timerId()
    if (id) {
      clearInterval(id)
    }
  })

  return (
    <div class="container mx-auto p-4 bg-white">
      <h1 class="mb-4 text-center text-3xl font-bold">Time Tracker</h1>

      {/* Current task */}
      {currentTask() && (
        <h2 class="mb-2 text-xl">
          Client: {selectedClient()} - Project: {selectedProject()} - Task:{" "}
          {currentTask()}
        </h2>
      )}

      <p class="mb-4 text-lg">Time: {formatTime(time())}</p>

      {/* Task input */}
      {!timerId() && (
        <div class="mb-4">
          <label class="mb-2 block font-bold">Client</label>
          <select
            class="mb-4 w-full rounded border border-gray-300 px-2 py-1"
            value={selectedClient()}
            onChange={(e: any) => setSelectedClient(e.currentTarget.value)}
          >
            <option value="">Select a client</option>
            <For each={clients()}>
              {(client: Client) => (
                <option value={client.name}>{client.name}</option>
              )}
            </For>
          </select>

          <label class="mb-2 block font-bold">Project</label>
          <select
            class="mb-4 w-full rounded border border-gray-300 px-2 py-1"
            value={selectedProject()}
            onChange={(e: any) => setSelectedProject(e.currentTarget.value)}
          >
            <option value="">Select a project</option>
            <For each={projects()}>
              {(project: Project) => (
                <option value={project.name}>{project.name}</option>
              )}
            </For>
          </select>

          <label class="mb-2 block font-bold">Task Name</label>
          <input
            type="text"
            class="mb-4 w-full rounded border border-gray-300 px-2 py-1"
            placeholder="Enter task name"
            value={taskName()}
            onInput={(e: any) => setTaskName(e.currentTarget.value)}
            onKeyDown={(e: any) => handleKeyDown(e)}
          />
        </div>
      )}

      {/* Timer button */}
      <button
        class="rounded bg-blue-500 px-4 py-2 font-bold text-white hover:bg-blue-600"
        onClick={toggleTimer}
      >
        {timerId() ? "Stop Tracking" : "Start Tracking"}
      </button>

      {/* Project and client creation */}
      {!timerId() && (
        <>
          <div class="mt-8">
            <h3 class="mb-4 text-xl font-bold">Create Project</h3>
            <div class="mb-4">
              <label class="mb-2 block font-bold">Project Name</label>
              <input
                type="text"
                class="mb-4 w-full rounded border border-gray-300 px-2 py-1"
                placeholder="Enter project name"
                value={newProjectName()}
                onInput={(e: any) => setNewProjectName(e.currentTarget.value)}
              />

              <label class="mb-2 block font-bold">Client (Optional)</label>
              <select
                class="mb-4 w-full rounded border border-gray-300 px-2 py-1"
                value={newProjectClientId()}
                onChange={(e: any) =>
                  setNewProjectClientId(e.currentTarget.value)
                }
              >
                <option value="">Select a client (optional)</option>
                <For each={clients()}>
                  {(client: Client) => (
                    <option value={client.id}>{client.name}</option>
                  )}
                </For>
              </select>

              <label class="inline-flex items-center">
                <input
                  type="checkbox"
                  class="form-checkbox"
                  checked={newProjectBillable()}
                  onChange={() => setNewProjectBillable(!newProjectBillable())}
                />
                <span class="ml-2">Billable</span>
              </label>

              {newProjectBillable() && (
                <div class="mt-2">
                  <label class="mb-2 block font-bold">
                    Billable Rate (THB/hour)
                  </label>
                  <input
                    type="number"
                    class="w-full rounded border border-gray-300 px-2 py-1"
                    value={newProjectBillableRate()}
                    onInput={(e: any) =>
                      setNewProjectBillableRate(
                        parseFloat(e.currentTarget.value)
                      )
                    }
                  />
                </div>
              )}

              <button
                class="mt-4 block rounded bg-green-500 px-4 py-2 font-bold text-white hover:bg-green-600"
                onClick={addProject}
              >
                Add Project
              </button>
            </div>
          </div>

          <div class="mt-8">
            <h3 class="mb-4 text-xl font-bold">Create Client</h3>
            <div class="mb-4">
              <label class="mb-2 block font-bold">Client Name</label>
              <input
                type="text"
                class="mb-4 w-full rounded border border-gray-300 px-2 py-1"
                placeholder="Enter client name"
                value={newClientName()}
                onInput={(e: any) => setNewClientName(e.currentTarget.value)}
              />

              <button
                class="rounded bg-green-500 px-4 py-2 font-bold text-white hover:bg-green-600"
                onClick={addClient}
              >
                Add Client
              </button>
            </div>
          </div>
        </>
      )}

      {/* Task history */}
      {getTaskHisotryEntries().length > 0 && (
        <div class="mt-8">
          <h3 class="mb-2 text-xl font-bold">Task History</h3>
          <ul class="list-disc pl-6">
            <For each={getTaskHisotryEntries()}>
              {(task: TaskHistoryEntry) => (
                <li class="mb-2">
                  {task.clientName} - {task.projectName} - {task.name}:{" "}
                  {task.duration} (from {task.startTime} to {task.endTime}){" "}
                  {task.billable ? `💰` : ""}
                </li>
              )}
            </For>
          </ul>
        </div>
      )}

      {/* Report */}
      {taskHistory().length > 0 && <Report reportData={generateReportData()} />}
      {/* reset data button */}
      <button
        class="mt-4 block rounded bg-red-500 px-4 py-2 font-bold text-white hover:bg-red-600"
        onClick={resetDatabase}
      >
        Reset Data
      </button>
    </div>
  )
}

const Report = (props: { reportData: ReportEntry[] }) => {
  return (
    <div class="mt-8">
      <h3 class="mb-4 text-xl font-bold">Report by project</h3>
      <table class="w-full table-auto">
        <thead>
          <tr>
            <th class="border px-4 py-2">Title</th>
            <th class="border px-4 py-2">Task Count</th>
            <th class="border px-4 py-2">Duration</th>
            <th class="border px-4 py-2">Amount</th>
          </tr>
        </thead>
        <tbody>
          <For each={props.reportData}>
            {(entry: ReportEntry) => (
              <tr>
                <td class="border px-4 py-2">
                  {entry.projectName} - {entry.clientName}
                </td>
                <td class="border px-4 py-2">{entry.taskCount}</td>
                <td class="border px-4 py-2">{entry.totalDuration}</td>
                <td class="border px-4 py-2">
                  {entry.totalAmount.toFixed(2)} THB
                </td>
              </tr>
            )}
          </For>
        </tbody>
      </table>
    </div>
  )
}

export default App
