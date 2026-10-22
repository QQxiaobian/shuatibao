import { useState } from 'react';
import { toast } from 'sonner';
import {
  BookOpen,
  ChevronDown,
  Plus,
  Trash2,
  Check,
  Sparkles,
  Pencil,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useQBanks } from '@/hooks/useQBanks';
import { useQuestionBank } from '@/hooks/useQuestionBank';
import { useWrongBook } from '@/hooks/useWrongBook';
import { useFavorites } from '@/hooks/useFavorites';
import { useExams } from '@/hooks/useExams';
import { cn } from '@/lib/utils';

export default function BankSwitcher() {
  const {
    banks,
    currentBank,
    switchBank,
    deleteBank,
    createBank,
    updateBank,
    DEFAULT_BANK_ID,
  } = useQBanks();
  const { allQuestions, deleteQuestionsByBankId } = useQuestionBank();
  const { clearWrongByBankId } = useWrongBook();
  const { clearFavoritesByBankId } = useFavorites();
  const { deleteExamsByBankId } = useExams();

  const [open, setOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [renameBankId, setRenameBankId] = useState<string | null>(null);
  const [bankNameInput, setBankNameInput] = useState('');

  // 计算各题库的题目数量
  const getBankQuestionCount = (bankId: string) => {
    return allQuestions.filter((q) => q.bankId === bankId).length;
  };

  const handleDelete = (bankId: string) => {
    if (bankId === DEFAULT_BANK_ID) {
      toast.error('默认示例题库不能删除');
      return;
    }
    setDeleteTargetId(bankId);
  };

  const confirmDelete = () => {
    if (!deleteTargetId) return;
    // 级联删除：题目、错题、收藏、试卷
    deleteQuestionsByBankId(deleteTargetId);
    clearWrongByBankId(deleteTargetId);
    clearFavoritesByBankId(deleteTargetId);
    deleteExamsByBankId(deleteTargetId);
    deleteBank(deleteTargetId);
    toast.success('题库已删除');
    setDeleteTargetId(null);
  };

  const handleCreateBank = () => {
    const name = bankNameInput.trim();
    if (!name) {
      toast.error('请输入题库名称');
      return;
    }
    createBank(name);
    toast.success('题库已创建');
    setBankNameInput('');
    setCreateOpen(false);
  };

  const openRename = (bankId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const bank = banks.find((b) => b.id === bankId);
    if (!bank) return;
    setRenameBankId(bankId);
    setBankNameInput(bank.name);
  };

  const handleRename = () => {
    if (!renameBankId) return;
    const name = bankNameInput.trim();
    if (!name) {
      toast.error('请输入题库名称');
      return;
    }
    updateBank(renameBankId, { name });
    toast.success('题库已重命名');
    setBankNameInput('');
    setRenameBankId(null);
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1 px-2 text-sm font-medium text-foreground"
          >
            <BookOpen className="size-4 text-primary" />
            <span className="max-w-[120px] truncate">
              {currentBank?.name || '选择题库'}
            </span>
            <ChevronDown className="size-3.5 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-2" align="start">
          <div className="mb-1 px-2 text-xs font-medium text-muted-foreground">
            我的题库（{banks.length}）
          </div>
          <div className="max-h-64 overflow-y-auto space-y-0.5">
            {banks.map((bank) => {
              const isActive = bank.id === currentBank?.id;
              const count = getBankQuestionCount(bank.id);
              return (
                <div
                  key={bank.id}
                  className={cn(
                    'group flex items-center justify-between gap-2 rounded-md px-2 py-2 cursor-pointer transition-colors',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'hover:bg-muted text-foreground',
                  )}
                  onClick={() => {
                    switchBank(bank.id);
                    setOpen(false);
                  }}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <BookOpen className="size-4 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {bank.name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {count} 道题
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5">
                    {isActive && <Check className="size-4 shrink-0 mr-1" />}
                    {bank.id !== DEFAULT_BANK_ID && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-6 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => openRename(bank.id, e)}
                          title="重命名"
                        >
                          <Pencil className="size-3.5 text-muted-foreground" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-6 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(bank.id);
                          }}
                          title="删除"
                        >
                          <Trash2 className="size-3.5 text-destructive" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-2 border-t pt-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-muted-foreground"
              onClick={() => {
                setOpen(false);
                setBankNameInput('');
                setCreateOpen(true);
              }}
            >
              <Plus className="mr-2 size-4" />
              新建题库
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <AlertDialog
        open={!!deleteTargetId}
        onOpenChange={(o) => !o && setDeleteTargetId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除题库？</AlertDialogTitle>
            <AlertDialogDescription>
              删除后该题库的所有题目、错题记录、收藏题目、试卷都会被一并清除，且无法恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive hover:bg-destructive/90"
            >
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 新建题库对话框 */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建题库</DialogTitle>
            <DialogDescription>
              创建一个空题库，可以后续手动添加题目或从 Excel 导入。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">题库名称</label>
              <Input
                placeholder="请输入题库名称"
                value={bankNameInput}
                onChange={(e) => setBankNameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateBank();
                }}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              取消
            </Button>
            <Button onClick={handleCreateBank}>创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 重命名题库对话框 */}
      <Dialog
        open={!!renameBankId}
        onOpenChange={(o) => !o && setRenameBankId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>重命名题库</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">题库名称</label>
              <Input
                placeholder="请输入题库名称"
                value={bankNameInput}
                onChange={(e) => setBankNameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRename();
                }}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameBankId(null)}>
              取消
            </Button>
            <Button onClick={handleRename}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
