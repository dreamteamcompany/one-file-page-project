import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import PageLayout from '@/components/layout/PageLayout';
import TicketDetailsContent from '@/components/tickets/TicketDetailsContent';
import TicketDetailsSidebar from '@/components/tickets/TicketDetailsSidebar';
import { useTicketData } from '@/hooks/useTicketData';
import { useTicketActions } from '@/hooks/useTicketActions';

const TicketDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const {
    ticket,
    statuses,
    comments,
    users,
    auditLogs,
    loading,
    loadingComments,
    loadingHistory,
    loadTicket,
    loadComments,
    loadHistory,
  } = useTicketData(id, location.state?.ticket || null);

  const {
    newComment,
    setNewComment,
    submittingComment,
    updating,
    sendingPing,
    uploadingFile,
    handleSubmitComment,
    handleUpdateStatus,
    handleSendPing,
    handleReaction,
    handleFileUpload,
    handleAssignUser,
    handleUpdateDueDate,
  } = useTicketActions(id, loadTicket, loadComments, loadHistory);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Icon name="Loader2" size={48} className="animate-spin text-primary" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <Icon name="FileQuestion" size={64} className="text-muted-foreground mb-4" />
        <p className="text-xl text-muted-foreground mb-4">Тикет не найден</p>
        <Button onClick={() => navigate('/tickets')}>Вернуться к списку</Button>
      </div>
    );
  }

  return (
    <PageLayout>
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 px-4 md:px-[25px] py-4 md:py-[18px] bg-[#1b254b]/50 backdrop-blur-[20px] rounded-[15px] border border-white/10">
        <div className="flex items-center gap-3 flex-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/tickets')}
            className="text-white hover:bg-white/10"
          >
            <Icon name="ArrowLeft" size={20} />
          </Button>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-white">Заявка #{ticket.id}</h1>
            <p className="text-sm text-white/60">{ticket.title}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 md:gap-3 px-3 md:px-[15px] py-2 md:py-[10px] rounded-[12px] bg-white/5 border border-white/10">
          <div className="w-8 h-8 md:w-9 md:h-9 rounded-[10px] bg-gradient-to-br from-primary to-secondary flex items-center justify-center font-bold text-white text-sm md:text-base">
            {user?.full_name?.charAt(0) || 'U'}
          </div>
          <div className="hidden sm:block">
            <div className="text-sm font-medium text-white">{user?.full_name}</div>
            <div className="text-xs text-white/60">{user?.email}</div>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-auto -mx-4 md:-mx-6 lg:-mx-[30px] px-4 md:px-6 lg:px-[30px] -mb-4 md:-mb-6 lg:-mb-[30px] pb-4 md:pb-6 lg:pb-[30px]">
        <div className="container max-w-[1600px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
          <div className="hidden lg:block">
            <TicketDetailsSidebar 
              ticket={ticket}
              statuses={statuses}
              users={users}
              updating={updating}
              sendingPing={sendingPing}
              isCustomer={ticket.created_by === user?.id}
              hasAssignee={!!ticket.assigned_to}
              onUpdateStatus={(statusId) => handleUpdateStatus(Number(statusId))}
              onAssignUser={handleAssignUser}
              onSendPing={handleSendPing}
              onApprovalChange={loadTicket}
              onUpdateDueDate={handleUpdateDueDate}
            />
          </div>

          <TicketDetailsContent
            ticket={ticket}
            comments={comments}
            loadingComments={loadingComments}
            newComment={newComment}
            submittingComment={submittingComment}
            sendingPing={sendingPing}
            userId={user?.id}
            onCommentChange={setNewComment}
            onSubmitComment={handleSubmitComment}
            onSendPing={handleSendPing}
            onReaction={handleReaction}
            availableUsers={users}
            auditLogs={auditLogs}
            loadingHistory={loadingHistory}
            onFileUpload={handleFileUpload}
            uploadingFile={uploadingFile}
          />

          <div className="lg:hidden">
            <TicketDetailsSidebar 
              ticket={ticket}
              statuses={statuses}
              users={users}
              updating={updating}
              sendingPing={sendingPing}
              isCustomer={ticket.created_by === user?.id}
              hasAssignee={!!ticket.assigned_to}
              onUpdateStatus={(statusId) => handleUpdateStatus(Number(statusId))}
              onAssignUser={handleAssignUser}
              onSendPing={handleSendPing}
              onApprovalChange={loadTicket}
              onUpdateDueDate={handleUpdateDueDate}
            />
          </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
};

export default TicketDetails;