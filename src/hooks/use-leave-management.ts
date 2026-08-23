"use client";
import { useMutation,useQuery,useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { cancelLeaveRequest,createLeaveType,decideLeaveRequest,getLeaveAttachmentUrl,getLeaveRequest,leaveRequestFilters,listActiveLeaveTypes,listHrLeaveRequests,listMyLeaveRequests,submitLeaveRequest,updateLeaveType } from "@/queries/leave-management";
import type { LeaveRequestFilters } from "@/schemas/leave-management";
export function useActiveLeaveTypes(){return useQuery({queryKey:queryKeys.leaveManagement.types(),queryFn:listActiveLeaveTypes});}
export function useMyLeaveRequests(input:Partial<LeaveRequestFilters>={}){const filters=leaveRequestFilters(input);return useQuery({queryKey:queryKeys.leaveManagement.mine(filters),queryFn:()=>listMyLeaveRequests(filters)});}
export function useHrLeaveRequests(input:Partial<LeaveRequestFilters>={}){const filters=leaveRequestFilters(input);return useQuery({queryKey:queryKeys.leaveManagement.hrQueue(filters),queryFn:()=>listHrLeaveRequests(filters)});}
export function useLeaveRequest(id:string){return useQuery({queryKey:queryKeys.leaveManagement.request(id),queryFn:()=>getLeaveRequest(id),enabled:Boolean(id)});}
export function useLeaveAttachmentUrl(path:string){return useQuery({queryKey:queryKeys.leaveManagement.attachment(path),queryFn:()=>getLeaveAttachmentUrl(path),enabled:Boolean(path),staleTime:45000});}
function useInvalidate(){const client=useQueryClient();return()=>{void client.invalidateQueries({queryKey:["leave-management"]});void client.invalidateQueries({queryKey:["reporting"]});void client.invalidateQueries({queryKey:["notifications"]});void client.invalidateQueries({queryKey:["administration","audit-logs"]});};}
export function useSubmitLeaveRequest(){const invalidate=useInvalidate();return useMutation({mutationFn:({draft,files}:{draft:unknown;files:File[]})=>submitLeaveRequest(draft,files),onSuccess:invalidate});}
export function useCancelLeaveRequest(){const invalidate=useInvalidate();return useMutation({mutationFn:cancelLeaveRequest,onSuccess:invalidate});}
export function useDecideLeaveRequest(){const invalidate=useInvalidate();return useMutation({mutationFn:decideLeaveRequest,onSuccess:invalidate});}
export function useCreateLeaveType(){const invalidate=useInvalidate();return useMutation({mutationFn:createLeaveType,onSuccess:invalidate});}
export function useUpdateLeaveType(){const invalidate=useInvalidate();return useMutation({mutationFn:updateLeaveType,onSuccess:invalidate});}
