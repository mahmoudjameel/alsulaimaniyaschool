import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import RequireRole from './components/RequireRole';

import Launcher from './pages/Launcher';
import Login from './pages/Login';

import AdminLayout from './layouts/AdminLayout';
import Dashboard from './pages/admin/Dashboard';
import Admissions from './pages/admin/Admissions';
import Students from './pages/admin/Students';
import AcademicStages from './pages/admin/AcademicStages';
import StudentProfile from './pages/admin/StudentProfile';
import Billing from './pages/admin/Billing';
import PaymentProofs from './pages/PaymentProofs';
import Payroll from './pages/admin/Payroll';
import Staff from './pages/admin/Staff';
import Disbursements from './pages/Disbursements';
import Expenses from './pages/admin/Expenses';
import FeeAid from './pages/FeeAid';
import FinanceReport from './pages/FinanceReport';
import WhatsAppReminders from './pages/WhatsAppReminders';
import AbsenceExcuses from './pages/admin/AbsenceExcuses';
import Classes from './pages/admin/Classes';
import ClassDetail from './pages/admin/ClassDetail';
import Teachers from './pages/admin/Teachers';
import TeacherDetail from './pages/admin/TeacherDetail';
import Cms from './pages/admin/Cms';
import Users from './pages/admin/Users';
import AdminGrades from './pages/admin/Grades';
import ActivityLog from './pages/admin/ActivityLog';

import TeacherLayout from './layouts/TeacherLayout';
import TeacherDashboard from './pages/teacher/Dashboard';
import Builder from './pages/teacher/Builder';
import Quiz from './pages/teacher/Quiz';
import TeacherGrades from './pages/teacher/Grades';
import TeacherAttendance from './pages/teacher/Attendance';
import Observations from './pages/teacher/Observations';
import ReportCard from './pages/ReportCard';

import AccountantLayout from './layouts/AccountantLayout';
import AccountantDashboard from './pages/accountant/Dashboard';
import AccountantInvoices from './pages/accountant/Invoices';
import Enrollment from './pages/accountant/Enrollment';

import ParentLayout from './layouts/ParentLayout';
import ParentHome from './pages/parent/ParentHome';
import ParentFees from './pages/parent/ParentFees';
import ParentProgress from './pages/parent/ParentProgress';
import ParentAnnouncements from './pages/parent/ParentAnnouncements';
import ParentAbsence from './pages/parent/ParentAbsence';
import ParentGrades from './pages/parent/ParentGrades';
import ParentAttendance from './pages/parent/ParentAttendance';
import ParentNotes from './pages/parent/ParentNotes';
import ParentInbox from './pages/parent/ParentInbox';

import ReceptionLayout from './layouts/ReceptionLayout';
import ReceptionDashboard from './pages/reception/ReceptionDashboard';

import StudentLayout from './layouts/StudentLayout';
import StudentHome from './pages/student/StudentHome';
import StudentClasses from './pages/student/StudentClasses';
import StudentAchievements from './pages/student/StudentAchievements';
import StudentGrades from './pages/student/StudentGrades';
import StudentAttendance from './pages/student/StudentAttendance';
import StudentFees from './pages/student/StudentFees';
import StudentAnnouncements from './pages/student/StudentAnnouncements';
import StudentNotes from './pages/student/StudentNotes';
import StudentToday from './pages/student/StudentToday';
import StudentHomework from './pages/student/StudentHomework';
import StudentInbox from './pages/student/StudentInbox';

import PublicLayout from './layouts/PublicLayout';
import PublicHome from './pages/public/Home';
import PublicClasses from './pages/public/Classes';
import PublicClassDetail from './pages/public/ClassDetail';
import PublicTeachers from './pages/public/Teachers';
import PublicArticles from './pages/public/Articles';
import PublicArticleDetail from './pages/public/ArticleDetail';
import Register from './pages/public/Register';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Launcher />} />
          <Route path="/login/:role" element={<Login />} />

          <Route path="/admin" element={<RequireRole role="admin"><AdminLayout /></RequireRole>}>
            <Route index element={<Dashboard />} />
            <Route path="admissions" element={<Admissions />} />
            <Route path="students" element={<Students />} />
            <Route path="stages" element={<AcademicStages />} />
            <Route path="students/:id" element={<StudentProfile />} />
            <Route path="billing" element={<Billing />} />
            <Route path="payments" element={<PaymentProofs />} />
            <Route path="fee-aid" element={<FeeAid />} />
            <Route path="finance-report" element={<FinanceReport />} />
            <Route path="whatsapp" element={<WhatsAppReminders />} />
            <Route path="absence-excuses" element={<AbsenceExcuses />} />
            <Route path="payroll" element={<Payroll />} />
            <Route path="staff" element={<Staff />} />
            <Route path="disbursements" element={<Disbursements />} />
            <Route path="expenses" element={<Expenses />} />
            <Route path="classes" element={<Classes />} />
            <Route path="classes/:id" element={<ClassDetail />} />
            <Route path="teachers" element={<Teachers />} />
            <Route path="teachers/:id" element={<TeacherDetail />} />
            <Route path="grades" element={<AdminGrades />} />
            <Route path="enrollment" element={<Enrollment />} />
            <Route path="cms" element={<Cms />} />
            <Route path="users" element={<Users />} />
            <Route path="activity" element={<ActivityLog />} />
          </Route>
          <Route path="/admin/students/:id/report-card" element={<RequireRole role="admin"><ReportCard /></RequireRole>} />

          <Route path="/teacher" element={<RequireRole role="teacher"><TeacherLayout /></RequireRole>}>
            <Route index element={<TeacherDashboard />} />
            <Route path="builder" element={<Builder />} />
            <Route path="quiz" element={<Quiz />} />
            <Route path="grades" element={<TeacherGrades />} />
            <Route path="attendance" element={<TeacherAttendance />} />
            <Route path="observations" element={<Observations />} />
          </Route>

          <Route path="/accountant" element={<RequireRole role="accountant"><AccountantLayout /></RequireRole>}>
            <Route index element={<AccountantDashboard />} />
            <Route path="invoices" element={<AccountantInvoices />} />
            <Route path="payments" element={<PaymentProofs />} />
            <Route path="fee-aid" element={<FeeAid />} />
            <Route path="finance-report" element={<FinanceReport />} />
            <Route path="whatsapp" element={<WhatsAppReminders />} />
            <Route path="payroll" element={<Payroll />} />
            <Route path="staff" element={<Staff />} />
            <Route path="disbursements" element={<Disbursements />} />
            <Route path="expenses" element={<Expenses />} />
            <Route path="enrollment" element={<Enrollment />} />
          </Route>

          <Route path="/reception" element={<RequireRole role="reception"><ReceptionLayout /></RequireRole>}>
            <Route index element={<ReceptionDashboard />} />
            <Route path="admissions" element={<Admissions />} />
            <Route path="students" element={<Students />} />
            <Route path="students/:id" element={<StudentProfile />} />
            <Route path="enrollment" element={<Enrollment />} />
            <Route path="absence-excuses" element={<AbsenceExcuses />} />
          </Route>
          <Route path="/reception/students/:id/report-card" element={<RequireRole role="reception"><ReportCard /></RequireRole>} />

          <Route path="/parent" element={<RequireRole role="parent"><ParentLayout /></RequireRole>}>
            <Route index element={<ParentHome />} />
            <Route path="fees" element={<ParentFees />} />
            <Route path="progress" element={<ParentProgress />} />
            <Route path="grades" element={<ParentGrades />} />
            <Route path="attendance" element={<ParentAttendance />} />
            <Route path="notes" element={<ParentNotes />} />
            <Route path="inbox" element={<ParentInbox />} />
            <Route path="announcements" element={<ParentAnnouncements />} />
            <Route path="absence" element={<ParentAbsence />} />
          </Route>
          <Route path="/parent/report-card/:id" element={<RequireRole role="parent"><ReportCard /></RequireRole>} />

          <Route path="/student" element={<RequireRole role="student"><StudentLayout /></RequireRole>}>
            <Route index element={<StudentHome />} />
            <Route path="today" element={<StudentToday />} />
            <Route path="classes" element={<StudentClasses />} />
            <Route path="grades" element={<StudentGrades />} />
            <Route path="attendance" element={<StudentAttendance />} />
            <Route path="homework" element={<StudentHomework />} />
            <Route path="achievements" element={<StudentAchievements />} />
            <Route path="fees" element={<StudentFees />} />
            <Route path="announcements" element={<StudentAnnouncements />} />
            <Route path="notes" element={<StudentNotes />} />
            <Route path="inbox" element={<StudentInbox />} />
          </Route>
          <Route path="/student/report-card/:id" element={<RequireRole role="student"><ReportCard /></RequireRole>} />

          <Route path="/site" element={<PublicLayout />}>
            <Route index element={<PublicHome />} />
            <Route path="classes" element={<PublicClasses />} />
            <Route path="classes/:id" element={<PublicClassDetail />} />
            <Route path="teachers" element={<PublicTeachers />} />
            <Route path="articles" element={<PublicArticles />} />
            <Route path="articles/:id" element={<PublicArticleDetail />} />
            <Route path="register" element={<Register />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
