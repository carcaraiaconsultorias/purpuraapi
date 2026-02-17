import { google } from "googleapis";
import { config } from "../config.mjs";

const DRIVE_FOLDER_MIME = "application/vnd.google-apps.folder";

function normalizePrivateKey(value) {
  if (typeof value !== "string") return "";
  return value.replace(/\\n/g, "\n").trim();
}

function sanitizeFolderPart(value, maxLength = 90) {
  const text = String(value ?? "")
    .trim()
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .slice(0, maxLength);
  return text;
}

function normalizePhoneDigits(value) {
  return String(value ?? "").replace(/\D/g, "");
}

function escapeDriveQueryValue(value) {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'");
}

function isNonEmpty(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function resolveTimeoutMs(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1_000) return 10_000;
  return Math.floor(parsed);
}

async function withTimeout(operation, timeoutMs, label) {
  const ms = resolveTimeoutMs(timeoutMs);
  let timeoutId;
  try {
    return await Promise.race([
      operation(),
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(`${label} timeout (${ms}ms)`)), ms);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export function hasGoogleDriveConfig(appConfig = config) {
  return (
    isNonEmpty(appConfig.googleDriveRootFolderId) &&
    isNonEmpty(appConfig.googleServiceAccountEmail) &&
    isNonEmpty(appConfig.googleServiceAccountPrivateKey)
  );
}

export function buildClientFolderName({ nome, whatsappPhone }) {
  const namePart = sanitizeFolderPart(nome || "Cliente");
  const phoneDigits = normalizePhoneDigits(whatsappPhone);
  if (phoneDigits) return `${namePart} - ${phoneDigits}`;
  return namePart;
}

export function createGoogleDriveClient(appConfig = config) {
  const privateKey = normalizePrivateKey(appConfig.googleServiceAccountPrivateKey);
  const auth = new google.auth.JWT({
    email: appConfig.googleServiceAccountEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
  return google.drive({
    version: "v3",
    auth,
    timeout: resolveTimeoutMs(appConfig.outboundHttpTimeoutMs),
  });
}

async function findExistingFolder({ driveClient, rootFolderId, folderName, timeoutMs }) {
  const escapedParent = escapeDriveQueryValue(rootFolderId);
  const escapedName = escapeDriveQueryValue(folderName);
  const query = [
    `mimeType='${DRIVE_FOLDER_MIME}'`,
    "trashed=false",
    `name='${escapedName}'`,
    `'${escapedParent}' in parents`,
  ].join(" and ");

  const response = await withTimeout(
    () =>
      driveClient.files.list({
        q: query,
        fields: "files(id,name,webViewLink)",
        pageSize: 1,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      }),
    timeoutMs,
    "google_drive_files_list",
  );

  const file = response?.data?.files?.[0];
  if (!file?.id) return null;
  return {
    id: file.id,
    name: file.name || folderName,
    webViewLink: file.webViewLink || "",
  };
}

async function createFolder({ driveClient, rootFolderId, folderName, timeoutMs }) {
  const response = await withTimeout(
    () =>
      driveClient.files.create({
        requestBody: {
          name: folderName,
          mimeType: DRIVE_FOLDER_MIME,
          parents: [rootFolderId],
        },
        fields: "id,name,webViewLink",
        supportsAllDrives: true,
      }),
    timeoutMs,
    "google_drive_files_create",
  );

  const file = response?.data;
  if (!file?.id) {
    throw new Error("Google Drive did not return folder id");
  }

  return {
    id: file.id,
    name: file.name || folderName,
    webViewLink: file.webViewLink || "",
  };
}

async function getFolderPermissions({ driveClient, fileId, timeoutMs }) {
  const response = await withTimeout(
    () =>
      driveClient.permissions.list({
        fileId,
        fields: "permissions(id,type,role,emailAddress,allowFileDiscovery)",
        supportsAllDrives: true,
        pageSize: 100,
      }),
    timeoutMs,
    "google_drive_permissions_list",
  );
  return Array.isArray(response?.data?.permissions) ? response.data.permissions : [];
}

async function enforceFolderPermissions({
  driveClient,
  fileId,
  shareWithEmail,
  shareRole,
  allowPublic,
  timeoutMs,
}) {
  const permissions = await getFolderPermissions({ driveClient, fileId, timeoutMs });
  let shared = false;
  let publicPermissionRemoved = false;

  if (!allowPublic) {
    const publicPermissions = permissions.filter((item) => item?.type === "anyone" && item?.id);
    for (const permission of publicPermissions) {
      await withTimeout(
        () =>
          driveClient.permissions.delete({
            fileId,
            permissionId: permission.id,
            supportsAllDrives: true,
          }),
        timeoutMs,
        "google_drive_permissions_delete",
      );
      publicPermissionRemoved = true;
    }
  }

  if (isNonEmpty(shareWithEmail)) {
    const normalizedEmail = shareWithEmail.trim().toLowerCase();
    const role = isNonEmpty(shareRole) ? shareRole.trim() : "reader";
    const hasPermission = permissions.some(
      (item) =>
        item?.type === "user" &&
        String(item?.emailAddress ?? "").toLowerCase() === normalizedEmail &&
        String(item?.role ?? "") === role,
    );

    if (!hasPermission) {
      await withTimeout(
        () =>
          driveClient.permissions.create({
            fileId,
            requestBody: {
              type: "user",
              role,
              emailAddress: shareWithEmail.trim(),
            },
            sendNotificationEmail: false,
            supportsAllDrives: true,
          }),
        timeoutMs,
        "google_drive_permissions_create",
      );
      shared = true;
    }
  }

  return { shared, publicPermissionRemoved };
}

async function readFolderMetadata({ driveClient, fileId, timeoutMs }) {
  const response = await withTimeout(
    () =>
      driveClient.files.get({
        fileId,
        fields: "id,name,webViewLink",
        supportsAllDrives: true,
      }),
    timeoutMs,
    "google_drive_files_get",
  );
  const file = response?.data;
  return {
    id: file?.id || fileId,
    name: file?.name || "",
    webViewLink: file?.webViewLink || `https://drive.google.com/drive/folders/${fileId}`,
  };
}

export async function ensureDriveFolder({
  driveClient,
  rootFolderId,
  folderName,
  shareWithEmail = "",
  shareRole = "reader",
  allowPublic = false,
  timeoutMs = 10_000,
}) {
  if (!driveClient) throw new Error("driveClient is required");
  if (!isNonEmpty(rootFolderId)) throw new Error("rootFolderId is required");
  if (!isNonEmpty(folderName)) throw new Error("folderName is required");

  const normalizedFolderName = sanitizeFolderPart(folderName, 120);
  const existing = await findExistingFolder({
    driveClient,
    rootFolderId: rootFolderId.trim(),
    folderName: normalizedFolderName,
    timeoutMs,
  });

  const folder = existing
    ? { ...existing, created: false }
    : {
        ...(await createFolder({
          driveClient,
          rootFolderId: rootFolderId.trim(),
          folderName: normalizedFolderName,
          timeoutMs,
        })),
        created: true,
      };

  const permissionResult = await enforceFolderPermissions({
    driveClient,
    fileId: folder.id,
    shareWithEmail,
    shareRole,
    allowPublic,
    timeoutMs,
  });

  const metadata = await readFolderMetadata({ driveClient, fileId: folder.id, timeoutMs });
  return {
    id: metadata.id,
    name: metadata.name || normalizedFolderName,
    webViewLink: metadata.webViewLink,
    created: folder.created,
    shared: permissionResult.shared,
    publicPermissionRemoved: permissionResult.publicPermissionRemoved,
  };
}

export async function ensureClientDriveFolder({
  dbPool,
  clienteId,
  fallbackNome = "",
  appConfig = config,
  driveClient,
}) {
  if (!clienteId) {
    return { enabled: false, status: "skipped_no_cliente_id" };
  }

  if (!hasGoogleDriveConfig(appConfig)) {
    return { enabled: false, status: "skipped_not_configured" };
  }

  const timeoutMs = resolveTimeoutMs(appConfig.outboundHttpTimeoutMs);
  const clienteResult = await dbPool.query(
    `
      select id, nome, whatsapp_phone, drive_folder_id, drive_folder_url
      from public.clientes
      where id = $1
      limit 1
    `,
    [clienteId],
  );

  const cliente = clienteResult.rows[0];
  if (!cliente) {
    return { enabled: true, status: "skipped_cliente_not_found" };
  }

  if (cliente.drive_folder_id) {
    return {
      enabled: true,
      status: "existing",
      folderId: cliente.drive_folder_id,
      folderUrl: cliente.drive_folder_url || `https://drive.google.com/drive/folders/${cliente.drive_folder_id}`,
    };
  }

  const client = driveClient || createGoogleDriveClient(appConfig);
  const folderName = buildClientFolderName({
    nome: cliente.nome || fallbackNome,
    whatsappPhone: cliente.whatsapp_phone,
  });

  const folder = await ensureDriveFolder({
    driveClient: client,
    rootFolderId: appConfig.googleDriveRootFolderId,
    folderName,
    shareWithEmail: appConfig.googleDriveShareWithEmail,
    shareRole: appConfig.googleDriveShareRole,
    allowPublic: appConfig.googleDriveAllowPublic === true,
    timeoutMs,
  });

  const dbClient = await dbPool.connect();
  try {
    await dbClient.query("begin");

    const lockedResult = await dbClient.query(
      `
        select drive_folder_id, drive_folder_url
        from public.clientes
        where id = $1
        limit 1
        for update
      `,
      [clienteId],
    );

    const locked = lockedResult.rows[0];
    if (!locked) {
      await dbClient.query("commit");
      return { enabled: true, status: "skipped_cliente_not_found" };
    }

    if (locked.drive_folder_id) {
      await dbClient.query("commit");
      return {
        enabled: true,
        status: "existing",
        folderId: locked.drive_folder_id,
        folderUrl: locked.drive_folder_url || `https://drive.google.com/drive/folders/${locked.drive_folder_id}`,
      };
    }

    await dbClient.query(
      `
        update public.clientes
        set drive_folder_id = $2,
            drive_folder_url = $3,
            drive_folder_created_at = now(),
            updated_at = now()
        where id = $1
      `,
      [clienteId, folder.id, folder.webViewLink],
    );

    await dbClient.query("commit");
  } catch (error) {
    await dbClient.query("rollback");
    console.error("drive_folder_persist_failed", {
      clienteId,
      folderId: folder.id || null,
      message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  } finally {
    dbClient.release();
  }

  return {
    enabled: true,
    status: folder.created ? "created" : "existing",
    folderId: folder.id,
    folderUrl: folder.webViewLink,
    shared: folder.shared,
    publicPermissionRemoved: folder.publicPermissionRemoved,
  };
}
