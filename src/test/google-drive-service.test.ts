import { describe, expect, it, vi } from "vitest";
import { buildClientFolderName, ensureDriveFolder, ensureClientDriveFolder } from "../../backend/services/google-drive-service.mjs";

function makeDriveClient() {
  return {
    files: {
      list: vi.fn(),
      create: vi.fn(),
      get: vi.fn(),
    },
    permissions: {
      list: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
  };
}

describe("google-drive-service", () => {
  it("builds deterministic folder name per client", () => {
    const name = buildClientFolderName({
      nome: "Cliente / Teste",
      whatsappPhone: "(11) 98888-7777",
    });
    expect(name).toBe("Cliente - Teste - 11988887777");
  });

  it("returns existing folder without creating duplicate", async () => {
    const driveClient = makeDriveClient();
    driveClient.files.list.mockResolvedValue({
      data: {
        files: [{ id: "folder_existing", name: "Cliente A", webViewLink: "https://drive.google.com/drive/folders/folder_existing" }],
      },
    });
    driveClient.permissions.list.mockResolvedValue({ data: { permissions: [] } });
    driveClient.files.get.mockResolvedValue({
      data: {
        id: "folder_existing",
        name: "Cliente A",
        webViewLink: "https://drive.google.com/drive/folders/folder_existing",
      },
    });

    const result = await ensureDriveFolder({
      driveClient,
      rootFolderId: "root123",
      folderName: "Cliente A - 5511999998888",
      allowPublic: false,
    });

    expect(result.created).toBe(false);
    expect(result.id).toBe("folder_existing");
    expect(driveClient.files.create).not.toHaveBeenCalled();
  });

  it("creates folder and enforces restricted permissions", async () => {
    const driveClient = makeDriveClient();
    driveClient.files.list.mockResolvedValue({ data: { files: [] } });
    driveClient.files.create.mockResolvedValue({
      data: {
        id: "folder_new",
        name: "Cliente B",
        webViewLink: "https://drive.google.com/drive/folders/folder_new",
      },
    });
    driveClient.permissions.list.mockResolvedValue({
      data: {
        permissions: [{ id: "perm_public", type: "anyone", role: "reader" }],
      },
    });
    driveClient.files.get.mockResolvedValue({
      data: {
        id: "folder_new",
        name: "Cliente B",
        webViewLink: "https://drive.google.com/drive/folders/folder_new",
      },
    });

    const result = await ensureDriveFolder({
      driveClient,
      rootFolderId: "root123",
      folderName: "Cliente B - 5511988887777",
      shareWithEmail: "time@empresa.com",
      shareRole: "reader",
      allowPublic: false,
    });

    expect(result.created).toBe(true);
    expect(result.shared).toBe(true);
    expect(result.publicPermissionRemoved).toBe(true);
    expect(driveClient.permissions.delete).toHaveBeenCalledTimes(1);
    expect(driveClient.permissions.create).toHaveBeenCalledTimes(1);
  });

  it("skips drive creation when cliente already has folder id", async () => {
    const driveClient = makeDriveClient();
    const query = vi.fn().mockResolvedValue({
      rows: [
        {
          id: "cliente_1",
          nome: "Cliente C",
          whatsapp_phone: "+5511990001111",
          drive_folder_id: "folder_existing",
          drive_folder_url: "https://drive.google.com/drive/folders/folder_existing",
        },
      ],
    });
    const dbPool = {
      query,
      connect: vi.fn(),
    };

    const result = await ensureClientDriveFolder({
      dbPool,
      clienteId: "cliente_1",
      appConfig: {
        googleDriveRootFolderId: "root123",
        googleServiceAccountEmail: "bot@example.com",
        googleServiceAccountPrivateKey: "-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----",
        googleDriveShareWithEmail: "",
        googleDriveShareRole: "reader",
        googleDriveAllowPublic: false,
      },
      driveClient,
    });

    expect(result.status).toBe("existing");
    expect(driveClient.files.list).not.toHaveBeenCalled();
    expect(dbPool.connect).not.toHaveBeenCalled();
  });
});
