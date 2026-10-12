-- Staff clean up chats: any message of their own company, one by one or the whole thread.
-- Clients cannot delete messages: the flood limit (limit_message_rate) counts stored rows, so deleting would reset it.
create policy messages_delete on public.messages for delete to authenticated
  using (public.is_staff_of(company_id));
grant delete on public.messages to authenticated;
