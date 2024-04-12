import { createSignal, onCleanup, For } from "solid-js"
import { TrayIcon } from "@tauri-apps/api/tray"
import {} from "@tauri-apps/api/app"
// Type definitions
type TaskHistoryEntry = {
  clientName: string
  projectName: string
  taskName: string
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

type ProjectEntry = {
  name: string
  clientName: string
  billable: boolean
  billableRate: number
}

type ClientEntry = {
  name: string
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
  const [taskHistory, setTaskHistory] = createSignal<TaskHistoryEntry[]>([])
  const [projects, setProjects] = createSignal<ProjectEntry[]>([])
  const [clients, setClients] = createSignal<ClientEntry[]>([])
  const [newProjectName, setNewProjectName] = createSignal<string>("")
  const [newProjectClient, setNewProjectClient] = createSignal<string>("")
  const [newProjectBillable, setNewProjectBillable] =
    createSignal<boolean>(false)
  const [newProjectBillableRate, setNewProjectBillableRate] =
    createSignal<number>(0)
  const [newClientName, setNewClientName] = createSignal<string>("")

  // Utility functions
  const formatDate = (date: Date): string => {
    return `${date.getHours().toString().padStart(2, "0")}:${date
      .getMinutes()
      .toString()
      .padStart(2, "0")}:${date.getSeconds().toString().padStart(2, "0")}`
  }

  const formatDuration = (duration: number): string => {
    const hours = Math.floor(duration / 3600)
    const minutes = Math.floor((duration % 3600) / 60)
    const seconds = duration % 60
    return `[${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}]`
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

  const stopTimer = (): void => {
    trayIcon()?.close()
    const duration = time()
    const endTime = new Date(startTime().getTime() + duration * 1000)
    clearInterval(timerId() as number)
    const selectedProjectData = projects().find(
      (project) => project.name === selectedProject()
    )
    setTaskHistory((currentHistory) => [
      ...currentHistory,
      {
        clientName: selectedClient(),
        projectName: selectedProject(),
        taskName: currentTask(),
        duration: formatDuration(duration),
        startTime: formatDate(startTime()),
        endTime: formatDate(endTime),
        billable: selectedProjectData?.billable || false,
        billableRate: selectedProjectData?.billableRate || 0,
      },
    ])
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
  const addProject = (): void => {
    if (!newProjectName().trim()) {
      alert("Please enter a project name.")
      return
    }
    setProjects((currentProjects) => [
      ...currentProjects,
      {
        name: newProjectName(),
        clientName: newProjectClient(),
        billable: newProjectBillable(),
        billableRate: newProjectBillableRate(),
      },
    ])
    setNewProjectName("")
    setNewProjectClient("")
    setNewProjectBillable(false)
    setNewProjectBillableRate(0)
  }

  const addClient = (): void => {
    if (!newClientName().trim()) {
      alert("Please enter a client name.")
      return
    }
    setClients((currentClients) => [
      ...currentClients,
      {
        name: newClientName(),
      },
    ])
    setNewClientName("")
  }

  // Report generation
  const generateReportData = (): ReportEntry[] => {
    const reportData: ReportEntry[] = []
    const groupedData: { [key: string]: TaskHistoryEntry[] } = {}

    taskHistory().forEach((task) => {
      const key = `${task.clientName}-${task.projectName}`
      if (!groupedData[key]) {
        groupedData[key] = []
      }
      groupedData[key].push(task)
    })

    for (const key in groupedData) {
      const tasks = groupedData[key]
      const taskCount = tasks.length // Get the count of tasks for the project
      const totalDuration = tasks.reduce(
        (sum, task) =>
          sum + parseInt(task.duration.slice(1, -1).split(":").join("")),
        0
      )
      const totalAmount = tasks.reduce(
        (sum, task) =>
          sum +
          (task.billable ? task.billableRate * (totalDuration / 3600) : 0),
        0
      )

      const [clientName, projectName] = key.split("-")
      reportData.push({
        clientName,
        projectName,
        taskCount, // Add the task count to the report entry
        totalDuration: formatDuration(totalDuration),
        totalAmount: Math.round(totalAmount * 100) / 100,
      })
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
              {(client: ClientEntry) => (
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
              {(project: ProjectEntry) => (
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
                value={newProjectClient()}
                onChange={(e: any) =>
                  setNewProjectClient(e.currentTarget.value)
                }
              >
                <option value="">Select a client (optional)</option>
                <For each={clients()}>
                  {(client: ClientEntry) => (
                    <option value={client.name}>{client.name}</option>
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
      {taskHistory().length > 0 && (
        <div class="mt-8">
          <h3 class="mb-2 text-xl font-bold">Task History</h3>
          <ul class="list-disc pl-6">
            <For each={taskHistory()}>
              {(task: TaskHistoryEntry) => (
                <li class="mb-2">
                  {task.clientName} - {task.projectName} - {task.taskName}:{" "}
                  {task.duration} (from {task.startTime} to {task.endTime}){" "}
                  {task.billable
                    ? `(Billable at ${task.billableRate} THB/hour)`
                    : ""}
                </li>
              )}
            </For>
          </ul>
        </div>
      )}

      {/* Report */}
      {taskHistory().length > 0 && <Report reportData={generateReportData()} />}
    </div>
  )
}

const Report = (props: { reportData: ReportEntry[] }) => {
  return (
    <div class="mt-8">
      <h3 class="mb-4 text-xl font-bold">Report</h3>
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
