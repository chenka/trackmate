import { createSignal, onCleanup, For } from "solid-js"
import { TrayIcon } from "@tauri-apps/api/tray"
import { confirm } from "@tauri-apps/plugin-dialog"
import { getCurrent } from "@tauri-apps/api/window"

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
import Timer from "./lib/timer"
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

function App() {
  const [timerId, setTimerId] = createSignal<number | null>(null)
  const [timerDuration, setTimerDuration] = createSignal<string>("00:00:00")
  const [trayIcon, setTrayIcon] = createSignal<null | TrayIcon>(null)
  const [selectedClient, setSelectedClient] = createSignal<string>("")
  const [selectedProject, setSelectedProject] = createSignal<string>("")
  const [taskName, setTaskName] = createSignal<string>("")
  const [currentTask, setCurrentTask] = createSignal<string>("")
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
  const timer = new Timer()

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
    const seconds = Math.floor(durationInSeconds % 60)
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
    const id = setInterval(() => {
      const duration = timer.getTime()
      setTimerDuration(duration)

      const title = `${taskName()} ${timerDuration()}`
      trayIcon()?.setTitle(title)
    }, 1000)
    setTimerId(id)
    timer.start()
  }

  const stopTimer = async (): Promise<void> => {
    if (trayIcon()) {
      await trayIcon()?.close()
    }
    timer.stop()

    clearInterval(timerId() as number)
    const selectedProjectData = projects().find(
      (project) => project.name === selectedProject()
    )
    console.log(timer.getStartTime(), "getStartTime")
    console.log(timer.getEndTime(), "getEndTime")
    await createTask({
      id: generateID(),
      name: currentTask(),
      startTime: timer.getStartTime() || "",
      endTime: timer.getEndTime() || "",
      clientId: selectedProjectData?.clientId || "",
      projectId: selectedProjectData?.id || "",
    })
    const tasks = await getTasks()
    setTaskHistory(tasks)
    setTimerId(null)
    setCurrentTask("")

    timer.reset()
    setTimerDuration(timer.getTime())
  }

  const toggleTimer = (): void => {
    timerId() ? stopTimer() : startTimer()
  }

  const createTrayIconTimer = async (): Promise<void> => {
    const _trayIcon = await TrayIcon.new({
      id: "timer",
      title: "[00:00:00]",
      action: (event) => {
        if (event.clickType === "Left") {
          getCurrent().setFocus()
        }
      },
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
    <div class="bg-purple-900 text-white min-h-screen p-6">
      <div class="flex items-center justify-center mb-6">
        <h2 class="text-4xl font-bold">{timerDuration()}</h2>
      </div>

      {/* Current task */}
      {currentTask() && (
        <h2 class="mb-2 text-xl">
          Client: {selectedClient()} - Project: {selectedProject()} - Task:{" "}
          {currentTask()}
        </h2>
      )}

      {/* Task input */}
      {!timerId() && (
        <div class="mb-4 bg-purple-800 p-4 rounded-lg">
          <label class="mb-2 block font-bold">Client</label>
          <select
            class="mb-4 w-full rounded border border-gray-300 px-2 py-1 text-black"
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
            class="mb-4 w-full rounded border border-gray-300 px-2 py-1 text-black"
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
            class="mb-4 w-full rounded border border-gray-300 px-2 py-1 text-black"
            placeholder="Enter task name"
            value={taskName()}
            onInput={(e: any) => setTaskName(e.currentTarget.value)}
            onKeyDown={(e: any) => handleKeyDown(e)}
          />
        </div>
      )}
      <div class="flex justify-center my-8">
        <button
          onClick={toggleTimer}
          class="bg-white text-purple-900 px-6 py-2 rounded-full font-semibold hover:bg-purple-100 active:bg-purple-200"
        >
          {timerId() ? "Stop" : "Start"}
        </button>
      </div>

      {/* Project and client creation */}
      {!timerId() && (
        <>
          <div class="mt-8">
            <h3 class="text-xl font-semibold mb-4">Create Project</h3>
            <div class="bg-purple-800 p-4 rounded-lg mb-6">
              <label class="mb-2 block font-bold">Project Name</label>
              <input
                type="text"
                class="mb-4 w-full rounded border border-gray-300 px-2 py-1 text-black"
                placeholder="Enter project name"
                value={newProjectName()}
                onInput={(e: any) => setNewProjectName(e.currentTarget.value)}
              />

              <label class="mb-2 block font-bold">Client (Optional)</label>
              <select
                class="mb-4 w-full rounded border border-gray-300 px-2 py-1 text-black"
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
                  class="form-checkbox text-black"
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
                    class="w-full rounded border border-gray-300 px-2 py-1 text-black"
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

          <h3 class="text-xl mt-8 font-semibold mb-4">Create Client</h3>
          <div class="mt-2 bg-purple-800 p-4 rounded-lg">
            <div class="mb-4">
              <label class="mb-2 block font-bold">Client Name</label>
              <input
                type="text"
                class="mb-4 w-full rounded border border-gray-300 px-2 py-1 text-black"
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
      <h3 class="text-xl font-semibold mt-8 mb-4">Task History</h3>
      <For
        each={Object.entries(
          groupTaskHistoryByDate(getTaskHisotryEntries())
        ).reverse()}
      >
        {([date, tasks]: [string, TaskHistoryEntry[]]) => (
          <div class="mb-8">
            <h3 class="text-xl font-bold mb-2">{date}</h3>
            <div class="bg-purple-800 p-4 rounded-lg">
              <For each={tasks}>
                {(task: TaskHistoryEntry) => (
                  <div class="flex justify-between mb-2">
                    <span>
                      {task.name} - {task.projectName} - {task.clientName}
                      {task.billable && (
                        <span class="text-green-500 ml-2">💰</span>
                      )}
                    </span>
                    <span>{task.duration}</span>
                  </div>
                )}
              </For>
            </div>
          </div>
        )}
      </For>

      {/* Report */}
      {taskHistory().length > 0 && <Report reportData={generateReportData()} />}
      {/* reset data button */}
      <button
        class="mt-4 block rounded bg-red-500 px-4 py-2 font-bold text-white hover:bg-red-600"
        onClick={async () => {
          const yes = await confirm(
            "Are you sure you want to delete all data?",
            { kind: "warning" }
          )
          if (yes) {
            resetDatabase()
          }
        }}
      >
        Reset Data
      </button>
    </div>
  )
}

function groupTaskHistoryByDate(
  taskHistory: TaskHistoryEntry[]
): Record<string, TaskHistoryEntry[]> {
  const groupedTasks: Record<string, TaskHistoryEntry[]> = {}

  for (const task of taskHistory) {
    const date = new Date(task.startTime).toLocaleDateString("en-US", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    })

    if (groupedTasks[date]) {
      groupedTasks[date].push(task)
    } else {
      groupedTasks[date] = [task]
    }
  }

  return groupedTasks
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
                  {entry.totalAmount.toFixed(0)} THB
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
