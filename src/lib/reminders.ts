import { LocalNotifications } from '@capacitor/local-notifications';
import { ExtractedTodo } from '../types';
import { isNativeAndroid } from './nativeBridge';

const notificationIdForTodo = (todoId: string) => {
  let hash = 0;
  for (let index = 0; index < todoId.length; index += 1) {
    hash = (hash * 31 + todoId.charCodeAt(index)) | 0;
  }
  return Math.abs(hash) || 1;
};

export const scheduleTodoReminder = async (todo: ExtractedTodo) => {
  if (!isNativeAndroid || !todo.reminderAt) return todo;

  const permission = await LocalNotifications.checkPermissions();
  const granted =
    permission.display === 'granted'
      ? permission
      : await LocalNotifications.requestPermissions();
  if (granted.display !== 'granted') {
    throw new Error('通知权限未授予');
  }

  const id = todo.reminderNotificationId || notificationIdForTodo(todo.id);
  await LocalNotifications.cancel({ notifications: [{ id }] }).catch(() => undefined);
  await LocalNotifications.schedule({
    notifications: [
      {
        id,
        title: '记言 Todo 提醒',
        body: todo.title,
        schedule: { at: new Date(todo.reminderAt) },
        extra: { todoId: todo.id },
      },
    ],
  });

  return { ...todo, reminderNotificationId: id };
};

export const cancelTodoReminder = async (todo?: Partial<ExtractedTodo>) => {
  if (!isNativeAndroid || !todo?.reminderNotificationId) return;
  await LocalNotifications.cancel({
    notifications: [{ id: todo.reminderNotificationId }],
  }).catch(() => undefined);
};
