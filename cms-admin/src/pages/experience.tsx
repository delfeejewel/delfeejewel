import { Create, Edit, useForm } from "@refinedev/antd"
import { Form, Input, Switch } from "antd"
import { useNavigate } from "react-router-dom"
import { IconPicker } from "../components/icon-picker"

const ExperienceForm = () => (
  <>
    <Form.Item label="Title" name="title" rules={[{ required: true }]}>
      <Input />
    </Form.Item>
    <Form.Item label="Description" name="description" rules={[{ required: true }]}>
      <Input.TextArea rows={3} />
    </Form.Item>
    <Form.Item label="CTA Label" name="cta_label" rules={[{ required: true }]}>
      <Input placeholder="e.g. BOOK NOW" />
    </Form.Item>
    <Form.Item label="Icon" name="icon_name" rules={[{ required: true }]}>
      <IconPicker />
    </Form.Item>
    <Form.Item label="Active" name="is_active" valuePropName="checked" initialValue={true}>
      <Switch />
    </Form.Item>
  </>
)

export const ExperienceCreate = () => {
  const navigate = useNavigate()
  const { formProps, saveButtonProps } = useForm({
    redirect: false,
    onMutationSuccess: () => navigate("/homepage?tab=experience"),
  })

  return (
    <Create saveButtonProps={saveButtonProps}>
      <Form {...formProps} layout="vertical">
        <ExperienceForm />
      </Form>
    </Create>
  )
}

export const ExperienceEdit = () => {
  const navigate = useNavigate()
  const { formProps, saveButtonProps } = useForm({
    redirect: false,
    onMutationSuccess: () => navigate("/homepage?tab=experience"),
  })

  return (
    <Edit saveButtonProps={saveButtonProps}>
      <Form {...formProps} layout="vertical">
        <ExperienceForm />
      </Form>
    </Edit>
  )
}
