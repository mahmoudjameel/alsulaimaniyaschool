import StaffPunchPage from '../../components/StaffPunchPage';

export default function ReceptionPunch() {
  return (
    <StaffPunchPage
      homeTo="/reception"
      detailsTo="/reception/punch"
      roleKicker="مكتب الاستقبال"
    />
  );
}
