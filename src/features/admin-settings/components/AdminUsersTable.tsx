"use client";

import { useState, useTransition } from "react";
import { ShieldCheck, ShieldX, Trash2, UserMinus, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  beginAdminSettingsMfaChallenge,
  deactivateAdminUser,
  deleteAdminUser,
  inviteAdminUser,
  revokeAdminMfa,
} from "@/features/admin-settings/actions";
import type { AuthAdminUserSummary } from "@/server/repositories/admin-repository";

type PendingAction =
  | { kind: "invite"; user: null; factorId: string | null; challengeId: string | null }
  | {
      kind: "deactivate" | "delete" | "revoke_mfa";
      user: AuthAdminUserSummary;
      factorId: string | null;
      challengeId: string | null;
    };

const actionLabels = {
  invite: "Invite admin",
  deactivate: "Deactivate admin",
  delete: "Delete admin",
  revoke_mfa: "Revoke MFA",
} as const;

export function AdminUsersTable({
  users,
}: Readonly<{ users: AuthAdminUserSummary[] }>) {
  const [rows, setRows] = useState(users);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function openAction(action: PendingAction) {
    setStatus(null);
    setEmail("");
    setMfaCode("");
    setPendingAction(action);
    setPendingId(action.kind === "invite" ? "invite" : action.user.id);

    startTransition(async () => {
      const challenge = await beginAdminSettingsMfaChallenge();

      if (challenge.ok) {
        setPendingAction({
          ...action,
          factorId: challenge.factorId,
          challengeId: challenge.challengeId,
        } as PendingAction);
      } else {
        setStatus(challenge.message);
      }

      setPendingId(null);
    });
  }

  function submitAction() {
    if (!pendingAction?.factorId || !pendingAction.challengeId) {
      return;
    }

    const mfa = {
      factorId: pendingAction.factorId,
      challengeId: pendingAction.challengeId,
      code: mfaCode,
    };
    const actionId = pendingAction.kind === "invite" ? "invite" : pendingAction.user.id;
    setPendingId(actionId);

    startTransition(async () => {
      const result =
        pendingAction.kind === "invite"
          ? await inviteAdminUser({ email, mfa })
          : pendingAction.kind === "deactivate"
            ? await deactivateAdminUser({ userId: pendingAction.user.id, mfa })
            : pendingAction.kind === "delete"
              ? await deleteAdminUser({ userId: pendingAction.user.id, mfa })
              : await revokeAdminMfa({ userId: pendingAction.user.id, mfa });

      if (result.ok) {
        if (pendingAction.kind === "invite" && result.user) {
          setRows((current) => [result.user!, ...current.filter((row) => row.id !== result.user!.id)]);
        } else if (pendingAction.kind === "delete" && result.affectedUserId) {
          setRows((current) => current.filter((row) => row.id !== result.affectedUserId));
        } else if (result.user) {
          setRows((current) =>
            current.map((row) => (row.id === result.user?.id ? result.user : row)),
          );
        }
        setStatus(`${actionLabels[pendingAction.kind]} complete.`);
        setPendingAction(null);
      } else {
        setStatus(result.message);
      }

      setPendingId(null);
    });
  }

  return (
    <>
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          {status ? (
            <div className="rounded-admin-md border border-admin-border bg-admin-surface-muted px-3 py-2 text-admin-sm text-admin-text">
              {status}
            </div>
          ) : (
            <span />
          )}
          <Button
            onClick={() =>
              openAction({ kind: "invite", user: null, factorId: null, challengeId: null })
            }
            size="sm"
            type="button"
          >
            <UserPlus className="size-4" />
            Add admin
          </Button>
        </div>

        <section className="overflow-hidden rounded-admin-md border border-admin-border bg-admin-surface">
          <Table>
            <TableHeader>
              <TableRow className="h-9">
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>MFA</TableHead>
                <TableHead>Last signin</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-40 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((user) => (
                <TableRow className="h-11" key={user.id}>
                  <TableCell>
                    <div className="font-medium text-admin-text">{user.email ?? "Unknown"}</div>
                    <div className="font-mono text-admin-caption text-admin-text-muted">{user.id}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.isActive ? "default" : "secondary"}>
                      {user.isActive ? "Active" : "Deactivated"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.mfaEnrolled ? "default" : "outline"}>
                      {user.mfaEnrolled ? (
                        <ShieldCheck className="size-3" />
                      ) : (
                        <ShieldX className="size-3" />
                      )}
                      {user.mfaEnrolled ? "Enrolled" : "Required"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-admin-sm text-admin-text-muted">
                    {formatDateTime(user.last_sign_in_at)}
                  </TableCell>
                  <TableCell className="text-admin-sm text-admin-text-muted">
                    {formatDateTime(user.created_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        aria-label={`Revoke MFA for ${user.email ?? user.id}`}
                        disabled={!user.mfaEnrolled || pendingId === user.id}
                        onClick={() =>
                          openAction({
                            kind: "revoke_mfa",
                            user,
                            factorId: null,
                            challengeId: null,
                          })
                        }
                        size="icon"
                        type="button"
                        variant="ghost"
                      >
                        <ShieldX className="size-4" />
                      </Button>
                      <Button
                        aria-label={`Deactivate ${user.email ?? user.id}`}
                        disabled={!user.isActive || pendingId === user.id}
                        onClick={() =>
                          openAction({
                            kind: "deactivate",
                            user,
                            factorId: null,
                            challengeId: null,
                          })
                        }
                        size="icon"
                        type="button"
                        variant="ghost"
                      >
                        <UserMinus className="size-4" />
                      </Button>
                      <Button
                        aria-label={`Delete ${user.email ?? user.id}`}
                        disabled={pendingId === user.id}
                        onClick={() =>
                          openAction({
                            kind: "delete",
                            user,
                            factorId: null,
                            challengeId: null,
                          })
                        }
                        size="icon"
                        type="button"
                        variant="ghost"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      </div>

      <Dialog open={pendingAction !== null} onOpenChange={(open) => (!open ? setPendingAction(null) : null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{pendingAction ? actionLabels[pendingAction.kind] : "Admin action"}</DialogTitle>
            <DialogDescription>
              MFA re-verification is required before this admin-user change is applied.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {pendingAction?.kind === "invite" ? (
              <Input
                onChange={(event) => setEmail(event.target.value)}
                placeholder="admin@example.com"
                type="email"
                value={email}
              />
            ) : pendingAction?.user ? (
              <div className="rounded-admin-md border border-admin-border bg-admin-surface-muted p-3 text-admin-sm">
                <div className="font-medium text-admin-text">{pendingAction.user.email ?? "Unknown"}</div>
                <div className="font-mono text-admin-caption text-admin-text-muted">
                  {pendingAction.user.id}
                </div>
              </div>
            ) : null}
            <Input
              inputMode="numeric"
              maxLength={6}
              onChange={(event) => setMfaCode(event.target.value)}
              placeholder="TOTP code"
              value={mfaCode}
            />
          </div>

          <DialogFooter>
            <Button onClick={() => setPendingAction(null)} type="button" variant="outline">
              Cancel
            </Button>
            <Button
              disabled={
                !pendingAction?.factorId ||
                !pendingAction.challengeId ||
                mfaCode.length !== 6 ||
                pendingId !== null
              }
              onClick={submitAction}
              type="button"
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return "Never";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en-AE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
