import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import Icon from '@/components/ui/icon';
import { apiFetch } from '@/utils/api';
import { useToast } from '@/hooks/use-toast';
import func2url from '../../../backend/func2url.json';

const AI_TRAINING_URL = func2url['api-ai-training'];

export interface TrainingRule {
  id: number;
  rule_text: string;
  is_active: boolean;
  created_at: string;
}

interface RulesTabProps {
  rules: TrainingRule[];
  onReload: () => void;
}

const RulesTab = ({ rules, onReload }: RulesTabProps) => {
  const { toast } = useToast();

  const [ruleDialog, setRuleDialog] = useState(false);
  const [editingRule, setEditingRule] = useState<TrainingRule | null>(null);
  const [ruleForm, setRuleForm] = useState({ rule_text: '', is_active: true });

  const openRuleDialog = (rule?: TrainingRule) => {
    if (rule) {
      setEditingRule(rule);
      setRuleForm({ rule_text: rule.rule_text, is_active: rule.is_active });
    } else {
      setEditingRule(null);
      setRuleForm({ rule_text: '', is_active: true });
    }
    setRuleDialog(true);
  };

  const saveRule = async () => {
    if (!ruleForm.rule_text.trim()) {
      toast({ title: 'Заполните текст правила', variant: 'destructive' });
      return;
    }

    const body = {
      ...(editingRule ? { id: editingRule.id } : {}),
      rule_text: ruleForm.rule_text.trim(),
      is_active: ruleForm.is_active,
    };

    const res = await apiFetch(AI_TRAINING_URL + '?endpoint=rules', {
      method: editingRule ? 'PUT' : 'POST',
      body: JSON.stringify(body),
    });

    if (res.ok) {
      toast({ title: editingRule ? 'Правило обновлено' : 'Правило добавлено' });
      setRuleDialog(false);
      onReload();
    } else {
      toast({ title: 'Ошибка сохранения', variant: 'destructive' });
    }
  };

  const deleteRule = async (id: number) => {
    const res = await apiFetch(AI_TRAINING_URL + '?endpoint=rules', {
      method: 'DELETE',
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      toast({ title: 'Правило удалено' });
      onReload();
    }
  };

  const toggleRule = async (rule: TrainingRule) => {
    const res = await apiFetch(AI_TRAINING_URL + '?endpoint=rules', {
      method: 'PUT',
      body: JSON.stringify({ id: rule.id, is_active: !rule.is_active }),
    });
    if (res.ok) onReload();
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Правила классификации</CardTitle>
              <CardDescription className="text-xs mt-1">
                Текстовые подсказки для AI. Например: «Если упоминается Stoma1C — это сервис 1С»
              </CardDescription>
            </div>
            <Button size="sm" className="gap-2" onClick={() => openRuleDialog()}>
              <Icon name="Plus" size={16} />
              Добавить
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {rules.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Icon name="Lightbulb" size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">Пока нет правил</p>
              <p className="text-xs mt-1">Добавьте правило, чтобы AI лучше понимал ваш контекст</p>
            </div>
          ) : (
            <div className="space-y-3">
              {rules.map(rule => (
                <div key={rule.id} className={`p-3 rounded-lg border transition-colors ${rule.is_active ? 'bg-muted/20 hover:bg-muted/40' : 'bg-muted/5 opacity-60'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">{rule.rule_text}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Switch
                        checked={rule.is_active}
                        onCheckedChange={() => toggleRule(rule)}
                      />
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openRuleDialog(rule)} title="Редактировать" aria-label="Редактировать">
                        <Icon name="Pencil" size={14} />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteRule(rule.id)} title="Удалить" aria-label="Удалить">
                        <Icon name="Trash2" size={14} />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={ruleDialog} onOpenChange={setRuleDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingRule ? 'Редактировать правило' : 'Новое правило'}</DialogTitle>
            <DialogDescription>
              Напишите правило для AI-классификатора своими словами
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Текст правила *</Label>
              <Textarea
                value={ruleForm.rule_text}
                onChange={e => setRuleForm(prev => ({ ...prev, rule_text: e.target.value }))}
                placeholder="Если упоминается Stoma1C или любая база 1С — это всегда сервис «1С и удалённый рабочий стол»"
                className="mt-1.5"
                rows={3}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Пишите как объясняли бы человеку. AI воспримет это как инструкцию.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={ruleForm.is_active}
                onCheckedChange={v => setRuleForm(prev => ({ ...prev, is_active: v }))}
              />
              <Label>Правило активно</Label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setRuleDialog(false)}>Отмена</Button>
              <Button onClick={saveRule}>
                {editingRule ? 'Сохранить' : 'Добавить'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default RulesTab;