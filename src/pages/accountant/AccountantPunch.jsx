import StaffPunchPage from '../../components/StaffPunchPage';

export default function AccountantPunch() {
  return (
    <StaffPunchPage
      homeTo="/accountant"
      detailsTo="/accountant/punch"
      roleKicker="الشؤون المالية"
    />
  );
}
