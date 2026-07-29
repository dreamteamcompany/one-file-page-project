import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import Icon from '@/components/ui/icon';
import { displayFromStorage as phoneDisplay } from '@/components/ui/phone-masked-input';
import { Ticket, getDeadlineProgress } from './TicketsListTypes';
import TicketCardDesktop from './TicketCardDesktop';
import { parseServerDate } from '@/utils/dateFormat';

interface TicketCardProps {
  ticket: Ticket;
  selectedTicketIds: number[];
  bulkMode: boolean;
  canCallPhone: boolean;
  onToggleTicket?: (ticketId: number) => void;
  onTicketClick: (ticket: Ticket) => void;
}

const getPhoneFromTicket = (ticket: Ticket): string | null => {
  const phoneField = ticket.custom_fields?.find(f => f.field_type === 'phone' && f.value);
  return phoneField ? phoneField.value.replace(/\D/g, '') : null;
};

const TicketCard = ({
  ticket,
  selectedTicketIds,
  bulkMode,
  canCallPhone,
  onToggleTicket,
  onTicketClick,
}: TicketCardProps) => {
  const isCritical = ticket.priority_name?.toLowerCase().includes('критич');
  const [showLastComment, setShowLastComment] = useState(false);
  const lastComment = ticket.last_comment;

  return (
    <Card
      key={ticket.id}
      className={`p-4 hover:shadow-lg transition-all cursor-pointer hover:border-primary/50 relative w-full overflow-hidden ${
        isCritical ? 'border-red-500 border-2' : ''
      } ${
        selectedTicketIds.includes(ticket.id) ? 'ring-2 ring-primary' : ''
      }`}
      style={isCritical ? {
        boxShadow: '0 0 20px rgba(239, 68, 68, 0.4), 0 0 40px rgba(239, 68, 68, 0.2)',
        animation: 'pulse-glow 2s ease-in-out infinite'
      } : {}}
      onClick={(e) => {
        if (bulkMode && onToggleTicket) {
          e.stopPropagation();
          onToggleTicket(ticket.id);
        } else {
          onTicketClick(ticket);
        }
      }}
    >
      {ticket.priority_color && (
        <div
          className="pointer-events-none absolute left-0 top-0 bottom-0 w-1.5 rounded-l-lg z-10"
          style={{ backgroundColor: ticket.priority_color }}
          aria-hidden="true"
        />
      )}
      <div className="relative">
      <div className="space-y-2 relative z-10">
        <div className="flex items-stretch justify-between gap-3">
          <div className="flex items-start gap-2 sm:gap-3 flex-1 min-w-0">
            {bulkMode && onToggleTicket && (
              <Checkbox
                checked={selectedTicketIds.includes(ticket.id)}
                onCheckedChange={(e) => {
                  if (e) onToggleTicket(ticket.id);
                }}
                onClick={(e) => e.stopPropagation()}
                className="mt-1"
              />
            )}
            <div className="flex items-center gap-2 flex-shrink-0">
              {(ticket.status_name === 'На согласовании' || ticket.status_name === 'Одобрена' || ticket.status_name === 'Отклонена') && (
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  ticket.status_name === 'На согласовании' ? 'bg-green-500' :
                  ticket.status_name === 'Отклонена' ? 'bg-red-500' :
                  'bg-blue-500'
                } animate-pulse`} />
              )}
              {ticket.category_icon && (
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Icon name={ticket.category_icon} size={16} className="text-primary sm:w-5 sm:h-5" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                {ticket.has_new && (
                  <span
                    className="relative inline-flex items-center justify-center flex-shrink-0 animate-pulse"
                    title="Новые сообщения"
                    aria-label="Новые сообщения"
                  >
                    <span className="absolute inline-flex h-3.5 w-3.5 rounded-full opacity-60" style={{ backgroundColor: '#f97316' }} />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full" style={{ backgroundColor: '#f97316', boxShadow: '0 0 0 2px #f97316, 0 0 8px rgba(249,115,22,0.8)' }} />
                  </span>
                )}
                <span className="text-xs font-mono text-foreground bg-muted px-2 py-0.5 rounded">#{ticket.id}</span>
                {isCritical && (
                  <Badge variant="destructive" className="text-xs font-bold uppercase flex items-center gap-1 animate-pulse">
                    <Icon name="AlertTriangle" size={12} />
                    Критично
                  </Badge>
                )}
                {!!ticket.unread_mentions && ticket.unread_mentions > 0 && (
                  <Badge className="flex items-center gap-1 text-xs font-bold uppercase bg-purple-500 hover:bg-purple-600 text-white animate-pulse">
                    <Icon name="AtSign" size={12} />
                    {ticket.unread_mentions}
                  </Badge>
                )}
                {ticket.client_replied && (
                  <Badge
                    className="flex items-center gap-1 text-xs font-bold uppercase text-white animate-pulse"
                    style={{ backgroundColor: '#f97316' }}
                    title={
                      ticket.client_replied_at
                        ? `Последний ответ клиента: ${(parseServerDate(ticket.client_replied_at) ?? new Date()).toLocaleString('ru-RU', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            timeZone: 'Europe/Moscow',
                          })}`
                        : 'Клиент оставил новый комментарий'
                    }
                  >
                    <Icon name="MessageSquareReply" size={12} />
                    Новый комментарий
                  </Badge>
                )}
              </div>
              <h3 className="font-semibold text-base line-clamp-2 md:line-clamp-1 break-all">
                {ticket.status_name === 'На согласовании' && '🔔 '}
                {ticket.status_name === 'Отклонена' && '❌ '}
                {ticket.status_name === 'Одобрена' && '✅ '}
                {ticket.title}
              </h3>
              {ticket.description && (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2 break-all">
                  {ticket.description.replace(/<[^>]*>/g, '')}
                </p>
              )}
            </div>
          </div>
          <TicketCardDesktop ticket={ticket} />
        </div>

        <div className="md:hidden pt-2.5 mt-1 space-y-2 border-t border-border">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {ticket.status_name && (
              <Badge
                variant="secondary"
                className="text-xs max-w-full truncate border"
                style={{
                  backgroundColor: `${ticket.status_color}33`,
                  color: ticket.status_color,
                  borderColor: `${ticket.status_color}80`,
                }}
              >
                {ticket.status_name}
              </Badge>
            )}
            {(ticket.customer_name || ticket.creator_name) && (
              <span className="inline-flex items-center gap-1.5 bg-blue-500/10 text-blue-400 rounded-md px-2 py-1 text-xs max-w-full">
                {ticket.creator_photo_url ? (
                  <img src={ticket.creator_photo_url} alt="" className="w-4 h-4 rounded-full object-cover flex-shrink-0" />
                ) : (
                  <Icon name="User" size={11} className="flex-shrink-0" />
                )}
                <span className="truncate">{ticket.customer_name || ticket.creator_name}</span>
              </span>
            )}
            {ticket.creator_department_name && (
              <span className="inline-flex items-center gap-1 bg-muted/60 text-muted-foreground rounded-md px-2 py-1 text-xs max-w-full">
                <Icon name="Building2" size={11} className="flex-shrink-0" />
                <span className="truncate">{ticket.creator_department_name}</span>
              </span>
            )}
            <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs leading-none max-w-full ${(ticket.assigned_to_name || ticket.assignee_name) ? 'bg-muted/60 text-muted-foreground' : 'bg-orange-500/10 text-orange-500'}`}>
              {ticket.assignee_photo_url ? (
                <img src={ticket.assignee_photo_url} alt="" className="w-4 h-4 rounded-full object-cover flex-shrink-0" />
              ) : (
                <Icon name={(ticket.assigned_to_name || ticket.assignee_name) ? "UserCheck" : "UserX"} size={11} className="block flex-shrink-0" />
              )}
              <span className="truncate leading-none">{ticket.assigned_to_name || ticket.assignee_name || 'Не назначен'}</span>
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {ticket.created_at && (
              <span className="inline-flex items-center gap-1.5 bg-muted text-foreground rounded-md px-2 py-1 text-xs">
                <Icon name="Clock" size={11} className="flex-shrink-0" />
                <span className="truncate">
                  {(parseServerDate(ticket.created_at) ?? new Date()).toLocaleString('ru-RU', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZone: 'Europe/Moscow',
                  })}
                </span>
              </span>
            )}
            {ticket.due_date && (
              <span className="inline-flex items-center gap-1.5 bg-muted text-foreground rounded-md px-2 py-1 text-xs">
                <Icon name="Calendar" size={11} className="flex-shrink-0" />
                <span className="truncate">
                  {(parseServerDate(ticket.due_date) ?? new Date()).toLocaleString('ru-RU', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZone: 'Europe/Moscow',
                  })}
                </span>
              </span>
            )}
            {ticket.due_date && (() => {
              const deadline = getDeadlineProgress(ticket.due_date);
              if (!deadline) return null;
              return (
                <span
                  className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium"
                  style={{
                    backgroundColor: `${deadline.color}20`,
                    color: deadline.color,
                  }}
                >
                  <Icon name="Timer" size={11} className="flex-shrink-0" />
                  <span className="truncate">{deadline.label}</span>
                </span>
              );
            })()}
          </div>
        </div>

        <div className="pt-1 space-y-2 -mt-1">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {(() => {
              const phone = getPhoneFromTicket(ticket);
              if (!canCallPhone || !phone) return null;
              return (
                <a
                  href={`tel:+${phone}`}
                  onClick={(e) => e.stopPropagation()}
                  title={phoneDisplay(`+${phone}`) || phone}
                  className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-500/15 hover:bg-green-500/25 active:bg-green-500/35 transition-colors"
                >
                  <Icon name="Phone" size={11} className="text-green-600" />
                </a>
              );
            })()}
            {ticket.department_name && (
              <span className="inline-flex items-center gap-1.5 bg-muted/60 text-muted-foreground rounded-md px-2 py-1">
                <Icon name="Building" size={11} />
                {ticket.department_name}
              </span>
            )}
            {ticket.ticket_service && (
              <span className="inline-flex items-center gap-1.5 bg-muted/60 text-muted-foreground rounded-md px-2 py-1">
                <Icon name="Tag" size={11} />
                {ticket.ticket_service.name}
              </span>
            )}
            {ticket.services && ticket.services.length > 0 && (
              <span className="inline-flex items-center gap-1.5 bg-muted/60 text-muted-foreground rounded-md px-2 py-1">
                <Icon name="Wrench" size={11} />
                {ticket.services.map(s => s.name).join(', ')}
              </span>
            )}
            {ticket.priority_name && (
              <span
                className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-medium"
                style={{
                  backgroundColor: `${ticket.priority_color}15`,
                  color: ticket.priority_color,
                }}
              >
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: ticket.priority_color }} />
                {ticket.priority_name}
              </span>
            )}
            {ticket.created_at && (
              <span className={`inline-flex items-center gap-1.5 text-muted-foreground/70 text-[11px] ${lastComment ? '' : 'ml-auto'}`}>
                <Icon name="Clock" size={11} />
                {(parseServerDate(ticket.created_at) ?? new Date()).toLocaleString('ru-RU', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                  timeZone: 'Europe/Moscow',
                })}
              </span>
            )}
            {lastComment && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowLastComment((v) => !v);
                }}
                title="Последний комментарий"
                aria-label="Показать последний комментарий"
                className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                <Icon name="MessageSquare" size={11} />
                <Icon name={showLastComment ? 'ChevronUp' : 'ChevronDown'} size={11} />
              </button>
            )}
          </div>
        </div>
      </div>
      </div>

      {lastComment && showLastComment && (
            <div
              className="relative z-30 mt-2 rounded-md border border-border bg-card px-3 py-2 text-xs"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-2 mb-1 text-[11px] text-muted-foreground">
                <span className="font-medium text-foreground truncate">
                  {lastComment.author_name || lastComment.author_email || 'Пользователь'}
                  {lastComment.is_internal && (
                    <span className="ml-1.5 inline-flex items-center gap-1 text-amber-600">
                      <Icon name="Lock" size={10} />
                      внутренний
                    </span>
                  )}
                </span>
                {lastComment.created_at && (
                  <span className="flex-shrink-0">
                    {(parseServerDate(lastComment.created_at) ?? new Date()).toLocaleString('ru-RU', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                      timeZone: 'Europe/Moscow',
                    })}
                  </span>
                )}
              </div>
              <p className="text-foreground/80 line-clamp-4 whitespace-pre-wrap break-words">
                {(lastComment.comment || '').replace(/<[^>]*>/g, '').trim() || '—'}
              </p>
            </div>
          )}
    </Card>
  );
};

export default TicketCard;