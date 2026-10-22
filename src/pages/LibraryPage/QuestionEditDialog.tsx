import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Trash2, Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { QUESTION_TYPE_LABELS, type IQuestion, type QuestionType, type Difficulty } from '@/data/questions';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

interface QuestionFormData {
  type: QuestionType;
  question: string;
  options: string[];
  answer: string | string[];
  analysis: string;
  subject: string;
  chapter: string;
  difficulty: Difficulty;
}

interface QuestionEditDialogProps {
  question?: IQuestion;
  onSave: (data: Omit<IQuestion, 'id' | 'createdAt' | 'updatedAt' | 'source' | 'bankId'>) => void;
  onDelete?: () => void;
  trigger?: React.ReactNode;
  mode?: 'create' | 'edit';
}

export default function QuestionEditDialog({
  question,
  onSave,
  onDelete,
  trigger,
  mode = 'create',
}: QuestionEditDialogProps) {
  const [open, setOpen] = useState(false);
  const [optionCount, setOptionCount] = useState(
    question?.options.length || (question?.type === 'judge' || question?.type === 'short' ? 0 : 4)
  );

  const getDefaultValues = (): QuestionFormData => {
    if (question) {
      return {
        type: question.type,
        question: question.question,
        options: [...question.options],
        answer: Array.isArray(question.answer) ? [...question.answer] : question.answer,
        analysis: question.analysis,
        subject: question.subject,
        chapter: question.chapter,
        difficulty: question.difficulty,
      };
    }
    return {
      type: 'single',
      question: '',
      options: ['', '', '', ''],
      answer: 'A',
      analysis: '',
      subject: '未分类',
      chapter: '未分类',
      difficulty: 2,
    };
  };

  const form = useForm<QuestionFormData>({
    defaultValues: getDefaultValues(),
  });

  const currentType = form.watch('type');

  const handleTypeChange = (type: QuestionType) => {
    form.setValue('type', type);
    if (type === 'judge') {
      setOptionCount(0);
      form.setValue('options', []);
      form.setValue('answer', '对');
    } else if (type === 'short') {
      setOptionCount(0);
      form.setValue('options', []);
      form.setValue('answer', '');
    } else if (type === 'multiple') {
      const currentOpts = form.getValues().options;
      const newOpts = currentOpts.length >= 2 ? currentOpts : ['', '', '', ''];
      setOptionCount(newOpts.length);
      form.setValue('options', newOpts);
      form.setValue('answer', ['A']);
    } else {
      const currentOpts = form.getValues().options;
      const newOpts = currentOpts.length >= 2 ? currentOpts : ['', '', '', ''];
      setOptionCount(newOpts.length);
      form.setValue('options', newOpts);
      form.setValue('answer', 'A');
    }
  };

  const addOption = () => {
    if (optionCount < 8) {
      const newCount = optionCount + 1;
      setOptionCount(newCount);
      const opts = [...form.getValues().options];
      while (opts.length < newCount) opts.push('');
      form.setValue('options', opts);
    }
  };

  const removeOption = (idx: number) => {
    if (optionCount <= 2) return;
    const opts = [...form.getValues().options];
    opts.splice(idx, 1);
    form.setValue('options', opts);
    setOptionCount(optionCount - 1);
    if (currentType === 'single') {
      form.setValue('answer', 'A');
    } else if (currentType === 'multiple') {
      form.setValue('answer', ['A']);
    }
  };

  const toggleMultiAnswer = (letter: string) => {
    const current = form.getValues().answer as string[];
    const newArr = current.includes(letter)
      ? current.filter((a) => a !== letter)
      : [...current, letter].sort();
    form.setValue('answer', newArr);
  };

  const onSubmit = (values: QuestionFormData) => {
    if (!values.question.trim()) {
      toast.error('题干不能为空');
      return;
    }
    const opts = (values.options || []).filter((o) => o.trim());
    if ((values.type === 'single' || values.type === 'multiple') && opts.length < 2) {
      toast.error('至少需要 2 个有效选项');
      return;
    }
    if (values.type === 'multiple') {
      const ans = values.answer as string[];
      if (ans.length === 0) {
        toast.error('请至少选择一个正确答案');
        return;
      }
    }
    onSave({
      type: values.type,
      question: values.question,
      options: opts,
      answer: values.answer,
      analysis: values.analysis,
      subject: values.subject || '未分类',
      chapter: values.chapter || '未分类',
      difficulty: values.difficulty,
    });
    setOpen(false);
    toast.success(mode === 'create' ? '添加成功' : '保存成功');
  };

  const handleDelete = () => {
    if (onDelete) {
      onDelete();
      setOpen(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          form.reset(getDefaultValues());
          setOptionCount(
            question?.options.length ||
              (question?.type === 'judge' || question?.type === 'short' ? 0 : 4)
          );
        }
      }}
    >
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <Plus className="mr-2 size-4" />
            新增题目
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? '新增题目' : '编辑题目'}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>题型</FormLabel>
                    <Select value={field.value} onValueChange={(v) => handleTypeChange(v as QuestionType)}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(QUESTION_TYPE_LABELS).map(([k, v]) => (
                          <SelectItem key={k} value={k}>
                            {v}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="difficulty"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>难度</FormLabel>
                    <Select value={String(field.value)} onValueChange={(v) => field.onChange(Number(v))}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="1">简单</SelectItem>
                        <SelectItem value="2">中等</SelectItem>
                        <SelectItem value="3">困难</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="question"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    题干 <span className="text-destructive">*</span>
                  </FormLabel>
                  <FormControl>
                    <Textarea rows={3} placeholder="请输入题干内容" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {(currentType === 'single' || currentType === 'multiple') && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <FormLabel>选项</FormLabel>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addOption}
                    disabled={optionCount >= 8}
                  >
                    <Plus className="mr-1 size-3" />
                    添加选项
                  </Button>
                </div>
                {Array.from({ length: optionCount }).map((_, idx) => {
                  const letter = LETTERS[idx];
                  return (
                    <div key={idx} className="flex items-center gap-2">
                      <Badge variant="outline" className="shrink-0">
                        {letter}
                      </Badge>
                      <FormField
                        control={form.control}
                        name={`options.${idx}`}
                        render={({ field }) => (
                          <FormControl>
                            <Input placeholder={`选项 ${letter}`} {...field} />
                          </FormControl>
                        )}
                      />
                      {optionCount > 2 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeOption(idx)}
                          className="shrink-0 text-destructive"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="space-y-2">
              <FormLabel>正确答案</FormLabel>
              {currentType === 'single' && (
                <Select
                  value={form.getValues().answer as string}
                  onValueChange={(v) => form.setValue('answer', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: optionCount }).map((_, idx) => (
                      <SelectItem key={idx} value={LETTERS[idx]}>
                        {LETTERS[idx]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {currentType === 'multiple' && (
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: optionCount }).map((_, idx) => {
                    const letter = LETTERS[idx];
                    const selected = (form.getValues().answer as string[]).includes(letter);
                    return (
                      <Button
                        key={idx}
                        type="button"
                        variant={selected ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => toggleMultiAnswer(letter)}
                      >
                        {letter}
                      </Button>
                    );
                  })}
                </div>
              )}
              {currentType === 'judge' && (
                <Select
                  value={form.getValues().answer as string}
                  onValueChange={(v) => form.setValue('answer', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="对">正确</SelectItem>
                    <SelectItem value="错">错误</SelectItem>
                  </SelectContent>
                </Select>
              )}
              {currentType === 'short' && (
                <Textarea
                  rows={3}
                  placeholder="请输入参考答案"
                  value={form.getValues().answer as string}
                  onChange={(e) => form.setValue('answer', e.target.value)}
                />
              )}
            </div>

            <FormField
              control={form.control}
              name="analysis"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>解析</FormLabel>
                  <FormControl>
                    <Textarea rows={2} placeholder="答案解析（可选）" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="subject"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>学科</FormLabel>
                    <FormControl>
                      <Input placeholder="学科分类" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="chapter"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>章节</FormLabel>
                    <FormControl>
                      <Input placeholder="所属章节" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              {mode === 'edit' && onDelete && (
                <Button type="button" variant="destructive" onClick={handleDelete}>
                  <Trash2 className="mr-2 size-4" />
                  删除
                </Button>
              )}
              <div className="flex-1" />
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                取消
              </Button>
              <Button type="submit">保存</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
