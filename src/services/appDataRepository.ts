import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { AppData } from '../types';

type WorkspaceMember = {
  workspace_id: string;
  role?: string;
  status?: string;
  workspaces?: {
    id: string;
    name: string;
    owner_id: string;
  } | Array<{
    id: string;
    name: string;
    owner_id: string;
  }> | null;
};

async function getPrimaryWorkspaceId(userId: string): Promise<string | null> {
  const { data: memberships, error: membershipsError } = await supabase
    .from('workspace_members')
    .select('workspace_id, role, status, workspaces(id, name, owner_id)')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: true });

  if (!membershipsError && memberships && memberships.length > 0) {
    const typedMemberships = memberships as unknown as WorkspaceMember[];
    const sharedMembership = typedMemberships.find(m => m.role !== 'owner');
    return (sharedMembership ?? typedMemberships[0]).workspace_id;
  }
  if (membershipsError) return null;

  const { data: existingWorkspace, error: existingError } = await supabase
    .from('workspaces')
    .select('id')
    .eq('owner_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existingError) return null;

  let workspaceId = existingWorkspace?.id as string | undefined;
  if (!workspaceId) {
    const { data: createdWorkspace, error: createWorkspaceError } = await supabase
      .from('workspaces')
      .insert({ owner_id: userId, name: 'Família' })
      .select('id')
      .single();
    if (createWorkspaceError) return null;
    workspaceId = createdWorkspace.id as string;
  }

  const { error: memberError } = await supabase
    .from('workspace_members')
    .upsert(
      { workspace_id: workspaceId, user_id: userId, role: 'owner', status: 'active', updated_at: new Date().toISOString() },
      { onConflict: 'workspace_id,user_id' },
    );
  if (memberError) throw memberError;

  return workspaceId;
}

export async function loadAppData(userId: string): Promise<AppData | null> {
  if (!isSupabaseConfigured) return null;
  const workspaceId = await getPrimaryWorkspaceId(userId);
  if (workspaceId) {
    const { data, error } = await supabase
      .from('app_data')
      .select('data')
      .eq('workspace_id', workspaceId)
      .maybeSingle();
    if (!error && data) return data.data as AppData;
  }

  const { data, error } = await supabase
    .from('app_data')
    .select('data')
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data) return null;
  return data.data as AppData;
}

export async function saveAppData(userId: string, appData: AppData): Promise<void> {
  if (!isSupabaseConfigured) return;
  const workspaceId = await getPrimaryWorkspaceId(userId);
  const updatedAt = new Date().toISOString();
  if (!workspaceId) {
    const { error } = await supabase
      .from('app_data')
      .upsert(
        { user_id: userId, data: appData, updated_at: updatedAt },
        { onConflict: 'user_id' },
      );
    if (error) throw error;
    return;
  }

  const { data: existing, error: existingError } = await supabase
    .from('app_data')
    .select('id')
    .eq('workspace_id', workspaceId)
    .maybeSingle();
  if (existingError) throw existingError;

  if (existing?.id) {
    const { error } = await supabase
      .from('app_data')
      .update({ data: appData, updated_at: updatedAt })
      .eq('workspace_id', workspaceId);
    if (error) throw error;
    return;
  }

  const { error } = await supabase
    .from('app_data')
    .insert({ workspace_id: workspaceId, user_id: userId, data: appData, updated_at: updatedAt });
  if (error) throw error;
}

export async function addUserToPrimaryWorkspace(ownerId: string, memberUserId: string, role: 'admin' | 'editor' | 'viewer' = 'viewer'): Promise<void> {
  if (!isSupabaseConfigured) return;
  const workspaceId = await getPrimaryWorkspaceId(ownerId);
  if (!workspaceId) {
    throw new Error('Tabelas de workspace ainda não existem no Supabase. Aplique a migration 20260629_workspaces_app_data.sql antes de compartilhar dados entre usuários.');
  }
  const { error } = await supabase
    .from('workspace_members')
    .upsert(
      { workspace_id: workspaceId, user_id: memberUserId, role, status: 'active', updated_at: new Date().toISOString() },
      { onConflict: 'workspace_id,user_id' },
    );
  if (error) throw error;
}
