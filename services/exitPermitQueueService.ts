import { ExitPermit, ExitPermitStatus, User, AppSettings } from '../types';
import { updateExitPermitStatus } from './storageService';

export interface ExitPermitQueueTask {
    id: string;
    permitId: string;
    permitNumber: string | number;
    targetStatus: ExitPermitStatus;
    prevStatus?: ExitPermitStatus;
    approverUser: User;
    extra?: {
        rejectionReason?: string;
        exitTime?: string;
        isReject?: boolean;
        vehiclePlate?: string;
        driverName?: string;
        driverMobile?: string;
        attachments?: string[];
        weighbridgeKg?: number;
        weighbridgeDate?: string;
        weighbridgeTime?: string;
        items?: any[];
    };
    permitSnapshot?: ExitPermit;
    settings?: AppSettings | null;
    retryCount: number;
    createdAt: number;
    status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
}

const QUEUE_STORAGE_KEY = 'vandar_exit_permit_queue_v1';

class ExitPermitQueueService {
    private queue: ExitPermitQueueTask[] = [];
    private isProcessing: boolean = false;
    private listeners: ((tasks: ExitPermitQueueTask[]) => void)[] = [];

    constructor() {
        this.loadQueue();
        // Start background processing if there are lingering tasks
        setTimeout(() => {
            this.processQueue();
        }, 1000);
    }

    private loadQueue() {
        try {
            const raw = localStorage.getItem(QUEUE_STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                    this.queue = parsed.filter(t => t.status === 'QUEUED' || t.status === 'PROCESSING');
                    // Reset processing to queued on reboot
                    this.queue.forEach(t => { if (t.status === 'PROCESSING') t.status = 'QUEUED'; });
                }
            }
        } catch (e) {
            console.error('Error loading exit permit queue from storage:', e);
            this.queue = [];
        }
    }

    private saveQueue() {
        try {
            localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(this.queue));
        } catch (e) {
            console.error('Error saving exit permit queue:', e);
        }
        this.notifyListeners();
    }

    public subscribe(listener: (tasks: ExitPermitQueueTask[]) => void) {
        this.listeners.push(listener);
        listener([...this.queue]);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    private notifyListeners() {
        this.listeners.forEach(l => {
            try { l([...this.queue]); } catch (e) {}
        });
    }

    /**
     * Enqueues an exit permit approval or rejection in the background
     * and immediately fires optimistic event for the UI.
     */
    public enqueueApproval(taskParams: {
        permitId: string;
        permitNumber: string | number;
        targetStatus: ExitPermitStatus;
        prevStatus?: ExitPermitStatus;
        approverUser: User;
        extra?: ExitPermitQueueTask['extra'];
        permitSnapshot?: ExitPermit;
        settings?: AppSettings | null;
    }): string {
        const taskId = `task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const newTask: ExitPermitQueueTask = {
            id: taskId,
            permitId: taskParams.permitId,
            permitNumber: taskParams.permitNumber,
            targetStatus: taskParams.targetStatus,
            prevStatus: taskParams.prevStatus,
            approverUser: taskParams.approverUser,
            extra: taskParams.extra,
            permitSnapshot: taskParams.permitSnapshot,
            settings: taskParams.settings,
            retryCount: 0,
            createdAt: Date.now(),
            status: 'QUEUED'
        };

        this.queue.push(newTask);
        this.saveQueue();

        // Dispatch optimistic broadcast so all open tabs / views update immediately
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('EXIT_PERMIT_OPTIMISTIC_APPLY', {
                detail: {
                    permitId: taskParams.permitId,
                    targetStatus: taskParams.targetStatus,
                    approverUser: taskParams.approverUser,
                    extra: taskParams.extra,
                    taskId
                }
            }));
        }

        // Kick off background worker asynchronously without blocking the UI thread
        setTimeout(() => {
            this.processQueue();
        }, 10);

        return taskId;
    }

    public getPendingCount(): number {
        return this.queue.filter(t => t.status === 'QUEUED' || t.status === 'PROCESSING').length;
    }

    private runningTasks: Set<string> = new Set();

    private async processQueue() {
        const queuedTasks = this.queue.filter(t => t.status === 'QUEUED' && !this.runningTasks.has(t.id));
        if (queuedTasks.length === 0) return;

        // Process all queued tasks concurrently in background without blocking UI
        await Promise.allSettled(
            queuedTasks.map(async (task) => {
                this.runningTasks.add(task.id);
                task.status = 'PROCESSING';
                this.saveQueue();

                let success = false;
                try {
                    // Step 1: Perform the API call to update status
                    const updatedPermits = await updateExitPermitStatus(
                        task.permitId,
                        task.targetStatus,
                        task.approverUser,
                        task.extra
                    );

                    const updatedPermit = updatedPermits.find(p => p.id === task.permitId);

                    // Step 2: Trigger sync event with full updated permits
                    if (updatedPermit) {
                        if (typeof window !== 'undefined') {
                            window.dispatchEvent(new CustomEvent('EXIT_PERMIT_BACKGROUND_SYNCED', {
                                detail: {
                                    permit: updatedPermit,
                                    allPermits: updatedPermits,
                                    prevStatus: task.prevStatus || task.permitSnapshot?.status,
                                    taskId: task.id
                                }
                            }));
                        }
                    }

                    success = true;
                } catch (err) {
                    console.error(`Background Exit Permit Task error for #${task.permitNumber}:`, err);
                    task.retryCount = (task.retryCount || 0) + 1;
                    if (task.retryCount > 3) {
                        task.status = 'FAILED';
                        this.queue = this.queue.filter(t => t.id !== task.id);
                    } else {
                        task.status = 'QUEUED';
                    }
                } finally {
                    this.runningTasks.delete(task.id);
                }

                if (success) {
                    task.status = 'COMPLETED';
                    this.queue = this.queue.filter(t => t.id !== task.id);
                }

                this.saveQueue();
            })
        );
    }
}

export const exitPermitQueueService = new ExitPermitQueueService();
