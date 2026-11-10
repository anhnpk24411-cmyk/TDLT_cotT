import { runSimulation, SimulationConfig } from '../engine/simulation.ts';
import { OrderLine, Product, FeeSchedule } from '../engine/types.ts';

export interface WorkerStartMessage {
  type: 'START';
  payload: {
    orders: OrderLine[];
    products: Product[];
    feeSchedules: FeeSchedule[];
    config: SimulationConfig;
  };
}

export interface WorkerCancelMessage {
  type: 'CANCEL';
}

export type WorkerInMessage = WorkerStartMessage | WorkerCancelMessage;

let isCancelled = false;

self.onmessage = (event: MessageEvent<WorkerInMessage>) => {
  const { data } = event;

  if (data.type === 'CANCEL') {
    isCancelled = true;
    self.postMessage({ type: 'CANCELLED' });
    return;
  }

  if (data.type === 'START') {
    isCancelled = false;
    const { orders, products, feeSchedules, config } = data.payload;

    try {
      const result = runSimulation(
        orders,
        products,
        feeSchedules,
        config,
        (progress, currentRun) => {
          if (isCancelled) {
            throw new Error('SIMULATION_CANCELLED');
          }
          self.postMessage({
            type: 'PROGRESS',
            progress,
            currentRun,
            totalRuns: config.iterations,
          });
        }
      );

      self.postMessage({
        type: 'COMPLETE',
        payload: result,
      });
    } catch (err: any) {
      if (err.message === 'SIMULATION_CANCELLED') {
        self.postMessage({ type: 'CANCELLED' });
      } else {
        self.postMessage({
          type: 'ERROR',
          error: err.message || 'Lỗi không xác định khi chạy mô phỏng.',
        });
      }
    }
  }
};

