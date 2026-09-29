# Bug Report

## Bug: Off-by-one error in pagination calculation

### Location
`src/services/taskService.js`, `getPaginated` function (lines 11–14).

### Expected behavior
When a client requests page 1 with a given limit (e.g., `page = 1, limit = 10`), the service should return the first page of results (items 0 to 9, offset 0). For page 2, it should return items 10 to 19 (offset 10). The standard offset formula for 1-indexed pagination is `(page - 1) * limit`.

### Actual behavior
The offset is calculated as `const offset = page * limit;`. For `page = 1, limit = 10`, `offset` evaluates to `10`. This skips the first 10 items (indexes 0 to 9) entirely. For any task list containing fewer than or equal to `limit` items, requesting page 1 returns an empty array `[]`.

### How it was discovered
Discovered by unit test `taskService.getPaginated(1, 2)` on a collection of 3 tasks and integration test `GET /tasks?page=1&limit=2`. Both tests expected tasks 1 and 2, but received only task 3 (or an empty array when items <= limit).

### Root cause
The calculation assumed 0-indexed page numbers (`offset = page * limit`), whereas the API routes (`routes/tasks.js`), documentation (`ASSIGNMENT.md`, `README.md`), and query conventions treat pagination as 1-indexed (`parseInt(page) || 1`). Because `0 || 1` evaluates to `1`, page 0 can never even be requested through the API, making the first `limit` items permanently unreachable via pagination.

### Proposed fix
Update the offset calculation in `src/services/taskService.js`:
```javascript
const getPaginated = (page, limit) => {
  const offset = (page - 1) * limit;
  return tasks.slice(offset, offset + limit);
};
```

### Severity / impact
**High**. The default paginated query (`GET /tasks?page=1&limit=10`) completely fails to return initial records, breaking the primary paginated retrieval contract of the API.

---

## Bug: Task priority is reset to 'medium' when completed

### Location
`src/services/taskService.js`, `completeTask` function (lines 67–73).

### Expected behavior
Marking a task as complete (`PATCH /tasks/:id/complete`) should only change its `status` to `'done'` and set `completedAt` to the current ISO timestamp. The task's existing `priority` (whether `'low'`, `'medium'`, or `'high'`) should remain unchanged.

### Actual behavior
The `completeTask` implementation explicitly hardcodes `priority: 'medium'` in the updated task object:
```javascript
const updated = {
  ...task,
  priority: 'medium',
  status: 'done',
  completedAt: new Date().toISOString(),
};
```
Completing a `'high'` or `'low'` priority task unexpectedly overwrites its priority to `'medium'`.

### How it was discovered
Discovered by inspecting the completion logic and verifying behavior when completing a task originally created with `priority: 'high'`.

### Root cause
An erroneous or copy-pasted `priority: 'medium'` assignment in `taskService.completeTask` that overrides `...task`.

### Proposed fix
Remove `priority: 'medium'` from the `updated` object in `src/services/taskService.js`:
```javascript
const updated = {
  ...task,
  status: 'done',
  completedAt: new Date().toISOString(),
};
```

### Severity / impact
**Medium**. Silently mutates historical task priority data upon completion, corrupting audit trails and priority metrics.

---

## Bug: Substring matching in status filtering

### Location
`src/services/taskService.js`, `getByStatus` function (line 9).

### Expected behavior
Filtering tasks by status (`GET /tasks?status=...`) should perform an exact match against allowed status values (`todo`, `in_progress`, `done`).

### Actual behavior
The function uses `String.prototype.includes`:
```javascript
const getByStatus = (status) => tasks.filter((t) => t.status.includes(status));
```
Querying `?status=do` returns tasks with both `todo` and `done` statuses because `"todo".includes("do")` and `"done".includes("do")` are both true.

### How it was discovered
Discovered by code review of `taskService.getByStatus` and testing partial status queries.

### Root cause
Using substring inclusion (`.includes()`) instead of exact string equality (`===`) on an enumerated field.

### Proposed fix
Change the filter predicate to exact match in `src/services/taskService.js`:
```javascript
const getByStatus = (status) => tasks.filter((t) => t.status === status);
```

### Severity / impact
**Medium**. Allows unintentional matches and prevents strict filtering on task statuses.

---

## Bug: Status filter query ignores pagination parameters

### Location
`src/routes/tasks.js`, `GET /` route handler (lines 14–24).

### Expected behavior
When a client requests filtered and paginated results simultaneously (e.g., `GET /tasks?status=todo&page=1&limit=5`), the API should return the paginated subset of the filtered results.

### Actual behavior
The route handler checks `if (status)` and immediately returns all matching tasks:
```javascript
if (status) {
  const tasks = taskService.getByStatus(status);
  return res.json(tasks);
}
```
Any `page` and `limit` parameters supplied alongside `status` are completely ignored.

### How it was discovered
Discovered by code review of route control flow in `src/routes/tasks.js`.

### Root cause
Early return in the `if (status)` branch before reaching the pagination handler, with no service method supporting both status filtering and pagination together.

### Proposed fix
Support pagination within status filtering by applying pagination slicing to filtered results or combining them in `taskService`.

### Severity / impact
**Low to Medium**. Limits API composability and causes unexpected payload sizes when clients attempt to paginate filtered views.

---

## Bug: Status enumeration documentation mismatch in README.md

### Location
`README.md` (lines 77, 96) vs `ASSIGNMENT.md` (line 50) and `src/utils/validators.js` (line 1).

### Expected behavior
Documentation should accurately reflect the valid status values accepted by the API: `'todo'`, `'in_progress'`, `'done'`.

### Actual behavior
`README.md` documents the status values as `"pending | in-progress | completed"` and suggests `curl "http://localhost:3000/tasks?status=pending&page=1&limit=10"`. Following this documentation causes the API validator to reject task creation with `400 Bad Request` (`status must be one of: todo, in_progress, done`), and status queries return empty results.

### How it was discovered
Discovered during Phase 1 documentation and validator review.

### Root cause
Out-of-date or misaligned API reference in `README.md` compared to the canonical specification in `ASSIGNMENT.md` and the implemented `VALID_STATUSES` array in `validators.js`.

### Proposed fix
Update `README.md` task shape and curl examples to use `todo`, `in_progress`, and `done`.

### Severity / impact
**Low**. Developer experience defect causing confusing 400 Bad Request responses for consumers following the README.
