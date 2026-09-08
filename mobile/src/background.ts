import * as BackgroundTask from "expo-background-task";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";
import { getClient, RadarAuthError } from "./api";
import { clearWidget, syncRadar } from "./sync";

const TASK = "radar-spv-refresh";
TaskManager.defineTask(TASK, async () => {
  try {
    const client = await getClient();
    const { data } = await client.auth.getSession();
    if (!data.session) { await clearWidget(); return BackgroundTask.BackgroundTaskResult.Success; }
    await syncRadar();
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch (error) {
    if (error instanceof RadarAuthError) await clearWidget();
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

export async function registerBackground() {
  if (Platform.OS !== "ios") return;
  if (await BackgroundTask.getStatusAsync() !== BackgroundTask.BackgroundTaskStatus.Available) return;
  if (!(await TaskManager.isTaskRegisteredAsync(TASK))) await BackgroundTask.registerTaskAsync(TASK, { minimumInterval: 30 });
}

export async function stopBackground() {
  if (await TaskManager.isTaskRegisteredAsync(TASK)) await BackgroundTask.unregisterTaskAsync(TASK);
}
