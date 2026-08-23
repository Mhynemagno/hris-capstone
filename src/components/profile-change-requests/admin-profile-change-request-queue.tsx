"use client";
import Link from "next/link";
import { useAdminProfileChangeRequests } from "@/hooks/use-profile-change-requests";
export function AdminProfileChangeRequestQueue() { const requests = useAdminProfileChangeRequests({ status: 'pending' }); if (!requests.data) return <p>Loading requests…</p>; return <div className="space-y-3">{requests.data.rows.map((request) => <article className="rounded border p-4" key={request.id}><p className="font-medium">Pending profile change</p><p className="text-sm text-muted-foreground">{new Date(request.created_at).toLocaleString()}</p><Link className="text-sm underline" href={`/admin/profile-change-requests/${request.id}`}>Review request</Link></article>)}{!requests.data.rows.length ? <p>No pending profile-change requests.</p> : null}</div>; }
