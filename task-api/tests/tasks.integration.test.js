const request = require('supertest');
const app = require('../src/app');
const taskService = require('../src/services/taskService');

describe('Tasks API (Integration Tests)', () => {
  beforeEach(() => {
    taskService._reset();
  });

  describe('GET /tasks', () => {
    it('returns 200 and an empty array when no tasks exist', async () => {
      const res = await request(app).get('/tasks');

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('returns 200 and all tasks when tasks exist', async () => {
      taskService.create({ title: 'Task 1' });
      taskService.create({ title: 'Task 2' });

      const res = await request(app).get('/tasks');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].title).toBe('Task 1');
      expect(res.body[1].title).toBe('Task 2');
    });

    describe('query parameter: ?status', () => {
      it('returns 200 and filters tasks by status', async () => {
        taskService.create({ title: 'Task 1', status: 'todo' });
        taskService.create({ title: 'Task 2', status: 'in_progress' });
        taskService.create({ title: 'Task 3', status: 'done' });

        const res = await request(app).get('/tasks?status=in_progress');

        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(1);
        expect(res.body[0].title).toBe('Task 2');
        expect(res.body[0].status).toBe('in_progress');
      });

      it('returns 200 and empty array when no tasks match status', async () => {
        taskService.create({ title: 'Task 1', status: 'todo' });

        const res = await request(app).get('/tasks?status=done');

        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
      });
    });

    describe('query parameters: ?page and ?limit', () => {
      it('returns 200 and the first page of results (page=1, limit=2)', async () => {
        taskService.create({ title: 'Task 1' });
        taskService.create({ title: 'Task 2' });
        taskService.create({ title: 'Task 3' });

        const res = await request(app).get('/tasks?page=1&limit=2');

        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(2);
        expect(res.body[0].title).toBe('Task 1');
        expect(res.body[1].title).toBe('Task 2');
      });

      it('returns 200 and the second page of results (page=2, limit=2)', async () => {
        taskService.create({ title: 'Task 1' });
        taskService.create({ title: 'Task 2' });
        taskService.create({ title: 'Task 3' });

        const res = await request(app).get('/tasks?page=2&limit=2');

        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(1);
        expect(res.body[0].title).toBe('Task 3');
      });

      it('returns 200 and all items when limit exceeds total tasks', async () => {
        taskService.create({ title: 'Task 1' });

        const res = await request(app).get('/tasks?page=1&limit=50');

        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(1);
      });

      it('returns 200 and empty array when page is beyond total tasks', async () => {
        taskService.create({ title: 'Task 1' });

        const res = await request(app).get('/tasks?page=5&limit=10');

        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
      });

      it('falls back to default page 1 and limit 10 when query values are non-numeric', async () => {
        taskService.create({ title: 'Task 1' });

        const res = await request(app).get('/tasks?page=invalid&limit=invalid');

        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(1);
        expect(res.body[0].title).toBe('Task 1');
      });
    });
  });

  describe('POST /tasks', () => {
    it('creates a task with 201 and expected defaults when only title is provided', async () => {
      const res = await request(app)
        .post('/tasks')
        .send({ title: 'New Task' });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.title).toBe('New Task');
      expect(res.body.description).toBe('');
      expect(res.body.status).toBe('todo');
      expect(res.body.priority).toBe('medium');
      expect(res.body.dueDate).toBeNull();
      expect(res.body.completedAt).toBeNull();
      expect(typeof res.body.createdAt).toBe('string');
    });

    it('creates a task with 201 when optional fields are provided', async () => {
      const dueDate = new Date(Date.now() + 86400000).toISOString();
      const payload = {
        title: 'Complete Feature',
        description: 'Implement new unit tests',
        status: 'in_progress',
        priority: 'high',
        dueDate,
      };

      const res = await request(app)
        .post('/tasks')
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.title).toBe(payload.title);
      expect(res.body.description).toBe(payload.description);
      expect(res.body.status).toBe(payload.status);
      expect(res.body.priority).toBe(payload.priority);
      expect(res.body.dueDate).toBe(dueDate);
    });

    it('returns 400 when title is missing', async () => {
      const res = await request(app)
        .post('/tasks')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toMatch(/title is required/i);
    });

    it('returns 400 when title is empty string', async () => {
      const res = await request(app)
        .post('/tasks')
        .send({ title: '' });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('returns 400 when title is only whitespace', async () => {
      const res = await request(app)
        .post('/tasks')
        .send({ title: '   ' });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('returns 400 when title is not a string', async () => {
      const res = await request(app)
        .post('/tasks')
        .send({ title: 12345 });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('returns 400 when status is invalid', async () => {
      const res = await request(app)
        .post('/tasks')
        .send({ title: 'Valid Title', status: 'invalid_status' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('status must be one of: todo, in_progress, done');
    });

    it('returns 400 when priority is invalid', async () => {
      const res = await request(app)
        .post('/tasks')
        .send({ title: 'Valid Title', priority: 'urgent' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('priority must be one of: low, medium, high');
    });

    it('returns 400 when dueDate is not a valid date string', async () => {
      const res = await request(app)
        .post('/tasks')
        .send({ title: 'Valid Title', dueDate: 'not-a-valid-date' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('dueDate must be a valid ISO date string');
    });
  });

  describe('PUT /tasks/:id', () => {
    it('returns 200 and updates task fields', async () => {
      const created = taskService.create({ title: 'Old Title', priority: 'low' });

      const res = await request(app)
        .put(`/tasks/${created.id}`)
        .send({
          title: 'Updated Title',
          priority: 'high',
        });

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(created.id);
      expect(res.body.title).toBe('Updated Title');
      expect(res.body.priority).toBe('high');
    });

    it('returns 404 when updating a nonexistent task id', async () => {
      const res = await request(app)
        .put('/tasks/nonexistent-id')
        .send({ title: 'Updated' });

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Task not found' });
    });

    it('returns 400 when update title is empty string', async () => {
      const created = taskService.create({ title: 'Valid' });

      const res = await request(app)
        .put(`/tasks/${created.id}`)
        .send({ title: '' });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('returns 400 when update status is invalid', async () => {
      const created = taskService.create({ title: 'Valid' });

      const res = await request(app)
        .put(`/tasks/${created.id}`)
        .send({ status: 'archived' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('status must be one of');
    });

    it('returns 400 when update priority is invalid', async () => {
      const created = taskService.create({ title: 'Valid' });

      const res = await request(app)
        .put(`/tasks/${created.id}`)
        .send({ priority: 'extreme' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('priority must be one of');
    });

    it('returns 400 when update dueDate is invalid date string', async () => {
      const created = taskService.create({ title: 'Valid' });

      const res = await request(app)
        .put(`/tasks/${created.id}`)
        .send({ dueDate: 'bad-date' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('dueDate must be a valid ISO date string');
    });
  });

  describe('DELETE /tasks/:id', () => {
    it('returns 204 and removes the task', async () => {
      const created = taskService.create({ title: 'Delete me' });

      const res = await request(app).delete(`/tasks/${created.id}`);

      expect(res.status).toBe(204);
      expect(res.body).toEqual({});
      expect(taskService.findById(created.id)).toBeUndefined();
    });

    it('returns 404 when deleting a nonexistent task id', async () => {
      const res = await request(app).delete('/tasks/nonexistent-id');

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Task not found' });
    });

    it('returns 404 when deleting an already deleted task', async () => {
      const created = taskService.create({ title: 'Delete twice' });

      await request(app).delete(`/tasks/${created.id}`);
      const res = await request(app).delete(`/tasks/${created.id}`);

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Task not found' });
    });
  });

  describe('PATCH /tasks/:id/complete', () => {
    it('returns 200 and marks task complete with status done and completedAt set', async () => {
      const created = taskService.create({ title: 'Finish this' });

      const res = await request(app).patch(`/tasks/${created.id}/complete`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(created.id);
      expect(res.body.status).toBe('done');
      expect(typeof res.body.completedAt).toBe('string');
      expect(new Date(res.body.completedAt).toISOString()).toBe(res.body.completedAt);
    });

    it('returns 404 when completing a nonexistent task id', async () => {
      const res = await request(app).patch('/tasks/nonexistent-id/complete');

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Task not found' });
    });
  });

  describe('GET /tasks/stats', () => {
    it('returns 200 and default stats when store is empty', async () => {
      const res = await request(app).get('/tasks/stats');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        todo: 0,
        in_progress: 0,
        done: 0,
        overdue: 0,
      });
    });

    it('returns 200 and accurate status counts and overdue count', async () => {
      const pastDate = new Date(Date.now() - 86400000).toISOString();
      const futureDate = new Date(Date.now() + 86400000).toISOString();

      taskService.create({ title: 'Overdue Todo', status: 'todo', dueDate: pastDate });
      taskService.create({ title: 'Active In Progress', status: 'in_progress', dueDate: futureDate });
      taskService.create({ title: 'Completed Past', status: 'done', dueDate: pastDate });

      const res = await request(app).get('/tasks/stats');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        todo: 1,
        in_progress: 1,
        done: 1,
        overdue: 1,
      });
    });
  });

  describe('Global error handling middleware', () => {
    it('catches unhandled exceptions and returns 500 Internal server error', async () => {
      const spy = jest.spyOn(taskService, 'getAll').mockImplementationOnce(() => {
        throw new Error('Database connection failed');
      });
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const res = await request(app).get('/tasks');

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Internal server error' });

      spy.mockRestore();
      consoleSpy.mockRestore();
    });
  });
});

