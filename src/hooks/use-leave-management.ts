"use client";
import { useMutation,useQuery,useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { cancelLeaveRequest,createLeaveType,decideLeaveRequest,getEmployeeLeaveBalances,getLeaveAttachmentUrl,getLeaveRequest,getMyLeaveBalances,leaveRequestFilters,leaveTypeFilters,listActiveLeaveTypes,listHrLeaveRequests,listLeaveTypes,listMyLeaveRequests,setLeaveTypeAllotment,submitLeaveRequest,updateLeaveType } from "@/queries/leave-management";
import type { LeaveRequestFilters, LeaveTypeFilters } from "@/schemas/leave-management";
/** All leave types visible to the caller, including inactive ones (HR admin list). */
export function useLeaveTypes(input:Partial<LeaveTypeFilters>={}){const filters=leaveTypeFilters(input);return useQuery({queryKey:queryKeys.leaveManagement.types(filters),queryFn:()=>listLeaveTypes(filters)});}
/** Leave types an employee can request right now (is_active = true). */
export function useRequestableLeaveTypes(){return useQuery({queryKey:[...queryKeys.leaveManagement.types(),"active"],queryFn:listActiveLeaveTypes});}
export function useMyLeaveRequests(input:Partial<LeaveRequestFilters>={}){const filters=leaveRequestFilters(input);return useQuery({queryKey:queryKeys.leaveManagement.mine(filters),queryFn:()=>listMyLeaveRequests(filters)});}
export function useHrLeaveRequests(input:Partial<LeaveRequestFilters>={}){const filters=leaveRequestFilters(input);return useQuery({queryKey:queryKeys.leaveManagement.hrQueue(filters),queryFn:()=>listHrLeaveRequests(filters)});}
export function useLeaveRequest(id:string){return useQuery({queryKey:queryKeys.leaveManagement.request(id),queryFn:()=>getLeaveRequest(id),enabled:Boolean(id)});}
/** The caller's used leave days per type for a year, for the remaining-days hint on the request form. */
export function useMyLeaveBalances(year:number){return useQuery({queryKey:queryKeys.leaveManagement.balances(year),queryFn:()=>getMyLeaveBalances(year)});}
export function useLeaveAttachmentUrl(path:string){return useQuery({queryKey:queryKeys.leaveManagement.attachment(path),queryFn:()=>getLeaveAttachmentUrl(path),enabled:Boolean(path),staleTime:45000});}
function useInvalidate(){const client=useQueryClient();return()=>{void client.invalidateQueries({queryKey:["leave-management"]});void client.invalidateQueries({queryKey:["reporting"]});void client.invalidateQueries({queryKey:["notifications"]});void client.invalidateQueries({queryKey:["administration","audit-logs"]});};}
export function useSubmitLeaveRequest(){const invalidate=useInvalidate();return useMutation({mutationFn:({draft,files}:{draft:unknown;files:File[]})=>submitLeaveRequest(draft,files),onSuccess:invalidate});}
export function useCancelLeaveRequest(){const invalidate=useInvalidate();return useMutation({mutationFn:cancelLeaveRequest,onSuccess:invalidate});}
export function useDecideLeaveRequest(){const invalidate=useInvalidate();return useMutation({mutationFn:decideLeaveRequest,onSuccess:invalidate});}
export function useCreateLeaveType(){const invalidate=useInvalidate();return useMutation({mutationFn:createLeaveType,onSuccess:invalidate});}
export function useUpdateLeaveType(){const invalidate=useInvalidate();return useMutation({mutationFn:updateLeaveType,onSuccess:invalidate});}
export function useSetLeaveTypeAllotment(){const invalidate=useInvalidate();return useMutation({mutationFn:setLeaveTypeAllotment,onSuccess:invalidate});}
export function useEmployeeLeaveBalances(employeeId: string | undefined, year: number) { return useQuery({ queryKey: [...queryKeys.leaveManagement.types(), "employee-balances", employeeId, year], queryFn: () => getEmployeeLeaveBalances(employeeId as string, year), enabled: Boolean(employeeId) }); }
