const taskService = require('../src/services/taskService');

describe('taskService (Unit Tests)', () => {
  beforeEach(() => {
    taskService._reset();
  });

  describe('create', () => {
    it('creates a task with expected defaults', () => {
      const task = taskService.create({ title: 'Default Task' });

      expect(task).toBeDefined();
      expect(typeof task.id).toBe('string');
      expect(task.id).toHaveLength(36); // UUID v4 format
      expect(task.title).toBe('Default Task');
      expect(task.description).toBe('');
      expect(task.status).toBe('todo');
      expect(task.priority).toBe('medium');
      expect(task.dueDate).toBeNull();
      expect(task.completedAt).toBeNull();
      expect(typeof task.createdAt).toBe('string');
      expect(new Date(task.createdAt).toISOString()).toBe(task.createdAt);
    });

    it('creates a task with supplied optional fields', () => {
      const dueDate = new Date(Date.now() + 86400000).toISOString();
      const task = taskService.create({
        title: 'Full Task',
        description: 'Detailed description',
        status: 'in_progress',
        priority: 'high',
        dueDate,
      });

      expect(task.title).toBe('Full Task');
      expect(task.description).toBe('Detailed description');
      expect(task.status).toBe('in_progress');
      expect(task.priority).toBe('high');
      expect(task.dueDate).toBe(dueDate);
    });
  });

  describe('getAll', () => {
    it('returns an empty array when no tasks exist', () => {
      const tasks = taskService.getAll();
      expect(tasks).toEqual([]);
    });

    it('returns all created tasks', () => {
      taskService.create({ title: 'Task 1' });
      taskService.create({ title: 'Task 2' });

      const tasks = taskService.getAll();
      expect(tasks).toHaveLength(2);
      expect(tasks.map((t) => t.title)).toEqual(['Task 1', 'Task 2']);
    });

    it('returns a shallow copy of tasks array', () => {
      taskService.create({ title: 'Task 1' });
      const tasks = taskService.getAll();
      tasks.push({ title: 'Injected' });

      expect(taskService.getAll()).toHaveLength(1);
    });
  });

  describe('findById', () => {
    it('returns the task with the matching id', () => {
      const created = taskService.create({ title: 'Find Me' });
      const found = taskService.findById(created.id);

      expect(found).toBeDefined();
      expect(found.id).toBe(created.id);
      expect(found.title).toBe('Find Me');
    });

    it('returns undefined when id is not found', () => {
      const found = taskService.findById('non-existent-id');
      expect(found).toBeUndefined();
    });
  });

  describe('getByStatus', () => {
    it('filters tasks by exact status correctly', () => {
      taskService.create({ title: 'Task 1', status: 'todo' });
      taskService.create({ title: 'Task 2', status: 'in_progress' });
      taskService.create({ title: 'Task 3', status: 'done' });
      taskService.create({ title: 'Task 4', status: 'todo' });

      const todoTasks = taskService.getByStatus('todo');
      expect(todoTasks).toHaveLength(2);
      expect(todoTasks.map((t) => t.title)).toEqual(['Task 1', 'Task 4']);

      const inProgressTasks = taskService.getByStatus('in_progress');
      expect(inProgressTasks).toHaveLength(1);
      expect(inProgressTasks[0].title).toBe('Task 2');

      const doneTasks = taskService.getByStatus('done');
      expect(doneTasks).toHaveLength(1);
      expect(doneTasks[0].title).toBe('Task 3');
    });

    it('returns an empty array when no tasks match the status', () => {
      taskService.create({ title: 'Task 1', status: 'todo' });
      const doneTasks = taskService.getByStatus('done');
      expect(doneTasks).toEqual([]);
    });
  });

  describe('getPaginated', () => {
    it('returns the correct subset for page 1 (1-indexed)', () => {
      taskService.create({ title: 'Task 1' });
      taskService.create({ title: 'Task 2' });
      taskService.create({ title: 'Task 3' });

      const page1 = taskService.getPaginated(1, 2);
      expect(page1).toHaveLength(2);
      expect(page1[0].title).toBe('Task 1');
      expect(page1[1].title).toBe('Task 2');
    });

    it('returns the correct subset for page 2', () => {
      taskService.create({ title: 'Task 1' });
      taskService.create({ title: 'Task 2' });
      taskService.create({ title: 'Task 3' });

      const page2 = taskService.getPaginated(2, 2);
      expect(page2).toHaveLength(1);
      expect(page2[0].title).toBe('Task 3');
    });

    it('returns an empty array when page is out of bounds', () => {
      taskService.create({ title: 'Task 1' });
      const result = taskService.getPaginated(5, 10);
      expect(result).toEqual([]);
    });
  });

  describe('update', () => {
    it('updates specified fields on an existing task', () => {
      const task = taskService.create({ title: 'Original Title', priority: 'low' });

      const updated = taskService.update(task.id, {
        title: 'Updated Title',
        priority: 'high',
      });

      expect(updated).toBeDefined();
      expect(updated.id).toBe(task.id);
      expect(updated.title).toBe('Updated Title');
      expect(updated.priority).toBe('high');
      expect(updated.description).toBe(''); // unchanged
    });

    it('returns null when attempting to update a nonexistent task', () => {
      const result = taskService.update('non-existent-id', { title: 'Updated' });
      expect(result).toBeNull();
    });
  });

  describe('remove', () => {
    it('removes an existing task and returns true', () => {
      const task = taskService.create({ title: 'To Delete' });

      const result = taskService.remove(task.id);
      expect(result).toBe(true);
      expect(taskService.findById(task.id)).toBeUndefined();
      expect(taskService.getAll()).toHaveLength(0);
    });

    it('returns false when task does not exist', () => {
      const result = taskService.remove('non-existent-id');
      expect(result).toBe(false);
    });
  });

  describe('completeTask', () => {
    it('marks a task as done and sets completedAt timestamp', () => {
      const task = taskService.create({ title: 'Finish Me' });
      const completed = taskService.completeTask(task.id);

      expect(completed).toBeDefined();
      expect(completed.id).toBe(task.id);
      expect(completed.status).toBe('done');
      expect(typeof completed.completedAt).toBe('string');
      expect(new Date(completed.completedAt).toISOString()).toBe(completed.completedAt);
    });

    it('returns null when completing a nonexistent task', () => {
      const result = taskService.completeTask('non-existent-id');
      expect(result).toBeNull();
    });
  });

  describe('getStats', () => {
    it('returns zero counts when there are no tasks', () => {
      const stats = taskService.getStats();
      expect(stats).toEqual({
        todo: 0,
        in_progress: 0,
        done: 0,
        overdue: 0,
      });
    });

    it('counts tasks by status correctly', () => {
      taskService.create({ title: 'T1', status: 'todo' });
      taskService.create({ title: 'T2', status: 'todo' });
      taskService.create({ title: 'T3', status: 'in_progress' });
      taskService.create({ title: 'T4', status: 'done' });

      const stats = taskService.getStats();
      expect(stats.todo).toBe(2);
      expect(stats.in_progress).toBe(1);
      expect(stats.done).toBe(1);
      expect(stats.overdue).toBe(0);
    });

    it('counts overdue tasks correctly', () => {
      const pastDate = new Date(Date.now() - 86400000).toISOString(); // 1 day ago
      const futureDate = new Date(Date.now() + 86400000).toISOString(); // 1 day ahead

      // Overdue: todo with past due date
      taskService.create({ title: 'Overdue Todo', status: 'todo', dueDate: pastDate });
      // Overdue: in_progress with past due date
      taskService.create({ title: 'Overdue In Progress', status: 'in_progress', dueDate: pastDate });
      // NOT Overdue: done task with past due date
      taskService.create({ title: 'Completed Past', status: 'done', dueDate: pastDate });
      // NOT Overdue: todo with future due date
      taskService.create({ title: 'Future Task', status: 'todo', dueDate: futureDate });
      // NOT Overdue: todo with null due date
      taskService.create({ title: 'No Due Date', status: 'todo', dueDate: null });

      const stats = taskService.getStats();
      expect(stats.todo).toBe(3);
      expect(stats.in_progress).toBe(1);
      expect(stats.done).toBe(1);
      expect(stats.overdue).toBe(2);
    });

    it('ignores tasks with unknown status gracefully', () => {
      const task = taskService.create({ title: 'Standard' });
      taskService.update(task.id, { status: 'archived' });

      const stats = taskService.getStats();
      expect(stats.todo).toBe(0);
      expect(stats.in_progress).toBe(0);
      expect(stats.done).toBe(0);
      expect(stats.overdue).toBe(0);
    });
  });

  describe('_reset', () => {
    it('resets internal tasks array to empty', () => {
      taskService.create({ title: 'Task' });
      expect(taskService.getAll()).toHaveLength(1);

      taskService._reset();
      expect(taskService.getAll()).toHaveLength(0);
    });
  });
});
