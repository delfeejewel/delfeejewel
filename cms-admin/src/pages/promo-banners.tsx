import { Create, Edit, useForm } from "@refinedev/antd"
import { Form, Input, Switch } from "antd"
import { useNavigate } from "react-router-dom"

const PromoBannerForm = () => (
  <>
    <Form.Item label="Title" name="title" rules={[{ required: true }]}>
      <Input />
    </Form.Item>
    <Form.Item label="Subtitle" name="subtitle">
      <Input />
    </Form.Item>
    <Form.Item label="CTA Label" name="cta_label" rules={[{ required: true }]}>
      <Input />
    </Form.Item>
    <Form.Item label="CTA Link" name="cta_href" rules={[{ required: true }]}>
      <Input />
    </Form.Item>
    <Form.Item label="Image URL" name="image_url">
      <Input />
    </Form.Item>
    <Form.Item label="Active" name="is_active" valuePropName="checked" initialValue={true}>
      <Switch />
    </Form.Item>
  </>
)

export const PromoBannerCreate = () => {
  const navigate = useNavigate()
  const { formProps, saveButtonProps } = useForm({
    redirect: false,
    onMutationSuccess: () => navigate("/homepage?tab=promo"),
  })
  return (
    <Create saveButtonProps={saveButtonProps}>
      <Form {...formProps} layout="vertical">
        <PromoBannerForm />
      </Form>
    </Create>
  )
}

export const PromoBannerEdit = () => {
  const navigate = useNavigate()
  const { formProps, saveButtonProps } = useForm({
    redirect: false,
    onMutationSuccess: () => navigate("/homepage?tab=promo"),
  })
  return (
    <Edit saveButtonProps={saveButtonProps}>
      <Form {...formProps} layout="vertical">
        <PromoBannerForm />
      </Form>
    </Edit>
  )
}
