import { useMemo } from 'react';
import { ApprovedExamsList } from '../parent/ParentExams';
import { ErrorBanner } from '../../components/ui';
import { useMyStudent, useStudentClassIds } from '../../hooks/useMyStudent';

export default function StudentExams() {
  const { enrolled, demo, error } = useMyStudent();
  const classIds = useStudentClassIds(enrolled, demo);
  const ids = useMemo(() => classIds, [classIds]);

  return (
    <div className="stu-page">
      <ErrorBanner>{error && 'تعذّر التحميل.'}</ErrorBanner>
      <header className="stu-page-head">
        <h1 className="stu-page-title">الاختبارات</h1>
        <p className="stu-page-lead">المواعيد المعتمدة · الأقرب أولاً</p>
      </header>
      <ApprovedExamsList classIds={ids} demo={demo} />
    </div>
  );
}
