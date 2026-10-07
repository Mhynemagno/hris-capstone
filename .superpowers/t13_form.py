p = "src/components/recruitment/hr-job-form.tsx"
s = open(p, encoding="utf-8").read()

def rep(a, b):
    global s
    assert a in s, a[:60]
    s = s.replace(a, b, 1)

rep('import Image from "next/image";', 'import Image from "next/image";\nimport Link from "next/link";')
rep('import { Button } from "@/components/ui/button";', 'import { Badge } from "@/components/ui/badge";\nimport { Button } from "@/components/ui/button";')
rep('import { Textarea } from "@/components/ui/textarea";', 'import { Textarea } from "@/components/ui/textarea";\nimport { notifySuccess } from "@/components/ui/toaster";')
rep('import { jobPostingImageUrl } from "@/lib/recruitment/job-posting-image";', 'import { jobPostingImageUrl } from "@/lib/recruitment/job-posting-image";\nimport { applicationCount, deadlineNote, JOB_STATUS_LABELS } from "@/lib/recruitment/job-postings";')
rep('import type { JobOpening, JobQualificationCriterion } from "@/lib/types/database";', 'import type { HrJob } from "@/queries/recruitment";')
rep("""type HrJobFormProps = {
  job?: JobOpening & { job_qualification_criteria?: JobQualificationCriterion[]; applications?: Array<{ count: number }> };
};""", """type HrJobFormProps = {
  job?: HrJob;
};""")
rep('  const [success, setSuccess] = useState<string | null>(null);\n', '')
rep('    setSuccess(null);\n', '')
rep("""      if (status === "published") {
        router.replace("/hr/jobs");""", """      if (status === "published") {
        notifySuccess("Posting published.");
        router.replace("/hr/jobs");""")
rep('setSuccess(hasApplications ? "Changes saved." : "Draft saved.");', 'notifySuccess(hasApplications ? "Changes saved." : "Draft saved.");')

start = s.index("  return (\n    <form")
end = s.rindex("}\n")
new = open(".superpowers/t13_form_jsx.txt", encoding="utf-8").read()
s = s[:start] + new + s[end:]
open(p, "w", encoding="utf-8").write(s)
print("ok")
