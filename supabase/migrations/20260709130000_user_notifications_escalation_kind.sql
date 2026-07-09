-- Permite el kind 'escalation' en user_notifications, usado por la función
-- notify-escalation para avisar a los responsables (María Fernanda / EW) cuando
-- el CSR escala un caso. El check original no lo contemplaba.

alter table public.user_notifications drop constraint if exists user_notifications_kind_check;
alter table public.user_notifications add constraint user_notifications_kind_check
  check (kind = any (array[
    'ticket_assigned','ticket_status_changed','note_added',
    'subtask_assigned','minute_shared','mention','escalation','system'
  ]));
