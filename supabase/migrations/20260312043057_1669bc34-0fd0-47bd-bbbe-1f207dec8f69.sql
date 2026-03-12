
-- Entregables: responsable y tarea vinculada
ALTER TABLE deliverables ADD COLUMN responsible_party text NOT NULL DEFAULT 'cisde';
ALTER TABLE deliverables ADD COLUMN responsible_team text;
ALTER TABLE deliverables ADD COLUMN linked_task_id integer;

-- Pendientes: responsable y tarea vinculada
ALTER TABLE action_items ADD COLUMN responsible_party text NOT NULL DEFAULT 'cisde';
ALTER TABLE action_items ADD COLUMN responsible_team text;
ALTER TABLE action_items ADD COLUMN linked_task_id integer;
