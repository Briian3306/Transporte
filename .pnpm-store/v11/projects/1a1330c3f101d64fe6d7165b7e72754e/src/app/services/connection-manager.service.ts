import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ConnectionManagerService {
  private activeConnections = new Set<string>();
  private connectionQueue = new Map<string, (() => void)[]>();
  private maxConcurrentConnections = 5;

  constructor() {}

  /**
   * Adquiere un bloqueo para una operación específica
   * @param operationId Identificador único de la operación
   * @returns Promise que se resuelve cuando se adquiere el bloqueo
   */
  async acquireLock(operationId: string): Promise<void> {
    return new Promise((resolve) => {
      if (this.activeConnections.size < this.maxConcurrentConnections) {
        this.activeConnections.add(operationId);
        resolve();
      } else {
        // Agregar a la cola
        if (!this.connectionQueue.has(operationId)) {
          this.connectionQueue.set(operationId, []);
        }
        this.connectionQueue.get(operationId)!.push(resolve);
      }
    });
  }

  /**
   * Libera un bloqueo y procesa la siguiente operación en cola
   * @param operationId Identificador de la operación a liberar
   */
  releaseLock(operationId: string): void {
    this.activeConnections.delete(operationId);
    
    // Procesar siguiente en cola
    if (this.connectionQueue.size > 0) {
      const nextOperation = this.connectionQueue.keys().next().value;
      if (nextOperation) {
        const callbacks = this.connectionQueue.get(nextOperation);
        if (callbacks && callbacks.length > 0) {
          const callback = callbacks.shift()!;
          this.activeConnections.add(nextOperation);
          callback();
          
          if (callbacks.length === 0) {
            this.connectionQueue.delete(nextOperation);
          }
        }
      }
    }
  }

  /**
   * Ejecuta una operación con gestión automática de bloqueos
   * @param operationId Identificador único de la operación
   * @param operation Función a ejecutar
   * @returns Resultado de la operación
   */
  async executeWithLock<T>(
    operationId: string,
    operation: () => Promise<T>
  ): Promise<T> {
    await this.acquireLock(operationId);
    
    try {
      const result = await operation();
      return result;
    } finally {
      this.releaseLock(operationId);
    }
  }

  /**
   * Obtiene estadísticas de conexiones activas
   */
  getConnectionStats(): {
    active: number;
    queued: number;
    maxConcurrent: number;
  } {
    return {
      active: this.activeConnections.size,
      queued: Array.from(this.connectionQueue.values()).reduce((total, queue) => total + queue.length, 0),
      maxConcurrent: this.maxConcurrentConnections
    };
  }

  /**
   * Limpia todas las conexiones (útil para testing o reset)
   */
  clearAllConnections(): void {
    this.activeConnections.clear();
    this.connectionQueue.clear();
  }
}
