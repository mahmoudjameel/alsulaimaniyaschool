import StaffPunchPage from '../../components/StaffPunchPage';

export default function TeacherPunch() {
  return (
    <StaffPunchPage
      homeTo="/teacher"
      detailsTo="/teacher/punch"
      roleKicker="الهيئة التدريسية"
    />
  );
}
