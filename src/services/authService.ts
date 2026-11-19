import { DEFAULT_COSMETICS } from '../config/cosmetics';
import type { PlayerCosmetics, UserProfile } from '../types/game';
import { getSupabaseClient, isSupabaseConfigured } from './supabaseClient';

const LOCAL_ACCOUNTS_KEY = 'au2_local_accounts_v1';
const LOCAL_SESSION_KEY = 'au2_local_session_v1';

interface LocalAccountRecord {
  id: string;
  email: string;
  passwordHash: string;
  profile: UserProfile;
}

interface ProfileRow {
  id: string;
  username: string;
  avatar_color: string;
  avatar_hat: string;
  avatar_visor: string;
  avatar_skin: string;
  avatar_pet: string;
  games_played: number;
  crewmate_wins: number;
  impostor_wins: number;
  tasks_completed: number;
  kills_total: number;
}

function simpleHash(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

function loadLocalAccounts(): Record<string, LocalAccountRecord> {
  try {
    const raw = localStorage.getItem(LOCAL_ACCOUNTS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, LocalAccountRecord>) : {};
  } catch {
    return {};
  }
}

function saveLocalAccounts(accounts: Record<string, LocalAccountRecord>): void {
  localStorage.setItem(LOCAL_ACCOUNTS_KEY, JSON.stringify(accounts));
}

function mapProfileRow(row: ProfileRow, email: string): UserProfile {
  return {
    id: row.id,
    email,
    username: row.username,
    cosmetics: {
      color: row.avatar_color || DEFAULT_COSMETICS.color,
      hat: row.avatar_hat || DEFAULT_COSMETICS.hat,
      visor: row.avatar_visor || DEFAULT_COSMETICS.visor,
      skin: row.avatar_skin || DEFAULT_COSMETICS.skin,
      pet: row.avatar_pet || DEFAULT_COSMETICS.pet,
    },
    stats: {
      gamesPlayed: row.games_played ?? 0,
      crewmateWins: row.crewmate_wins ?? 0,
      impostorWins: row.impostor_wins ?? 0,
      tasksCompleted: row.tasks_completed ?? 0,
      killsTotal: row.kills_total ?? 0,
    },
    isLocalDemo: false,
  };
}

export async function getCurrentProfile(): Promise<UserProfile | null> {
  const supabase = getSupabaseClient();
  if (supabase) {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session?.user) {
      const { data: row } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle<ProfileRow>();

      if (row) {
        return mapProfileRow(row, session.user.email ?? '');
      }

      // Create missing profile row gracefully
      const fallbackName =
        (session.user.user_metadata?.username as string | undefined) ||
        session.user.email?.split('@')[0] ||
        'Tripulante';

      const { data: inserted } = await supabase
        .from('profiles')
        .upsert({
          id: session.user.id,
          username: fallbackName.slice(0, 24),
        })
        .select('*')
        .single<ProfileRow>();

      if (inserted) {
        return mapProfileRow(inserted, session.user.email ?? '');
      }
    }
  }

  // Local demo session hydration (when running without Supabase env vars or in demo mode)
  try {
    const sessionEmail = localStorage.getItem(LOCAL_SESSION_KEY);
    if (!sessionEmail) return null;
    const accounts = loadLocalAccounts();
    return accounts[sessionEmail]?.profile ?? null;
  } catch {
    return null;
  }
}

export async function registerAccount(
  email: string,
  password: string,
  username: string,
  forceLocalDemo = false
): Promise<UserProfile> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanName = username.trim().slice(0, 24);
  if (cleanName.length < 2) {
    throw new Error('El nombre de usuario debe tener al menos 2 caracteres.');
  }
  if (password.length < 6) {
    throw new Error('La contraseña debe tener al menos 6 caracteres.');
  }

  const supabase = !forceLocalDemo ? getSupabaseClient() : null;
  if (supabase && isSupabaseConfigured) {
    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: { username: cleanName },
      },
    });

    if (error) {
      throw new Error(error.message);
    }

    if (!data.user) {
      throw new Error('No se pudo crear la cuenta en Supabase.');
    }

    if (!data.session) {
      throw new Error(
        'Cuenta creada. Revisa tu correo electrónico para confirmar tu cuenta y luego inicia sesión.'
      );
    }

    const { data: profileRow, error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: data.user.id,
        username: cleanName,
      })
      .select('*')
      .single<ProfileRow>();

    if (profileError || !profileRow) {
      throw new Error(profileError?.message ?? 'Error inicializando el perfil.');
    }

    return mapProfileRow(profileRow, cleanEmail);
  }

  // Local Demo fallback account creation
  const accounts = loadLocalAccounts();
  if (accounts[cleanEmail]) {
    throw new Error('Ya existe una cuenta local con ese correo. Inicia sesión.');
  }

  const id = `local_${crypto.randomUUID()}`;
  const profile: UserProfile = {
    id,
    email: cleanEmail,
    username: cleanName,
    cosmetics: { ...DEFAULT_COSMETICS },
    stats: {
      gamesPlayed: 0,
      crewmateWins: 0,
      impostorWins: 0,
      tasksCompleted: 0,
      killsTotal: 0,
    },
    isLocalDemo: true,
  };

  accounts[cleanEmail] = {
    id,
    email: cleanEmail,
    passwordHash: simpleHash(password),
    profile,
  };
  saveLocalAccounts(accounts);
  localStorage.setItem(LOCAL_SESSION_KEY, cleanEmail);
  return profile;
}

export async function loginAccount(
  email: string,
  password: string,
  forceLocalDemo = false
): Promise<UserProfile> {
  const cleanEmail = email.trim().toLowerCase();
  const supabase = !forceLocalDemo ? getSupabaseClient() : null;

  if (supabase && isSupabaseConfigured) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });
    if (error) {
      throw new Error(error.message);
    }
    if (!data.user) {
      throw new Error('Credenciales inválidas.');
    }

    const { data: row } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .maybeSingle<ProfileRow>();

    if (row) {
      return mapProfileRow(row, cleanEmail);
    }

    const fallbackName =
      (data.user.user_metadata?.username as string | undefined) ||
      cleanEmail.split('@')[0] ||
      'Tripulante';

    const { data: inserted, error: insErr } = await supabase
      .from('profiles')
      .upsert({ id: data.user.id, username: fallbackName.slice(0, 24) })
      .select('*')
      .single<ProfileRow>();

    if (insErr || !inserted) {
      throw new Error(insErr?.message ?? 'Error cargando perfil.');
    }

    return mapProfileRow(inserted, cleanEmail);
  }

  // Local Demo login
  const accounts = loadLocalAccounts();
  const existing = accounts[cleanEmail];
  if (!existing) {
    throw new Error('No se encontró ninguna cuenta local con ese correo. Regístrate primero.');
  }
  if (existing.passwordHash !== simpleHash(password)) {
    throw new Error('Contraseña incorrecta.');
  }
  localStorage.setItem(LOCAL_SESSION_KEY, cleanEmail);
  return existing.profile;
}

export async function logoutAccount(): Promise<void> {
  const supabase = getSupabaseClient();
  if (supabase) {
    await supabase.auth.signOut();
  }
  localStorage.removeItem(LOCAL_SESSION_KEY);
}

export async function updateUserCustomization(
  profile: UserProfile,
  username: string,
  cosmetics: PlayerCosmetics
): Promise<UserProfile> {
  const cleanName = username.trim().slice(0, 24);
  if (cleanName.length < 2) {
    throw new Error('El apodo debe tener al menos 2 caracteres.');
  }

  const supabase = !profile.isLocalDemo ? getSupabaseClient() : null;
  if (supabase && isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('profiles')
      .update({
        username: cleanName,
        avatar_color: cosmetics.color,
        avatar_hat: cosmetics.hat,
        avatar_visor: cosmetics.visor,
        avatar_skin: cosmetics.skin,
        avatar_pet: cosmetics.pet,
      })
      .eq('id', profile.id)
      .select('*')
      .single<ProfileRow>();

    if (error || !data) {
      throw new Error(error?.message ?? 'No se pudo guardar la personalización.');
    }

    return mapProfileRow(data, profile.email);
  }

  // Local Demo persistence
  const updated: UserProfile = {
    ...profile,
    username: cleanName,
    cosmetics: { ...cosmetics },
  };
  const accounts = loadLocalAccounts();
  if (accounts[profile.email]) {
    accounts[profile.email].profile = updated;
    saveLocalAccounts(accounts);
  }
  return updated;
}

export async function recordUserMatchStats(
  profile: UserProfile,
  won: boolean,
  wasImpostor: boolean,
  tasksCompleted: number,
  kills: number
): Promise<UserProfile> {
  const supabase = !profile.isLocalDemo ? getSupabaseClient() : null;
  if (supabase && isSupabaseConfigured) {
    await supabase.rpc('record_my_match_stats', {
      p_won: won,
      p_was_impostor: wasImpostor,
      p_tasks_completed: tasksCompleted,
      p_kills: kills,
    });
  }

  const updated: UserProfile = {
    ...profile,
    stats: {
      gamesPlayed: profile.stats.gamesPlayed + 1,
      crewmateWins: profile.stats.crewmateWins + (won && !wasImpostor ? 1 : 0),
      impostorWins: profile.stats.impostorWins + (won && wasImpostor ? 1 : 0),
      tasksCompleted: profile.stats.tasksCompleted + Math.max(0, tasksCompleted),
      killsTotal: profile.stats.killsTotal + Math.max(0, kills),
    },
  };

  if (profile.isLocalDemo) {
    const accounts = loadLocalAccounts();
    if (accounts[profile.email]) {
      accounts[profile.email].profile = updated;
      saveLocalAccounts(accounts);
    }
  }

  return updated;
}
