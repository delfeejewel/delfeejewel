import { Create, Edit, useForm } from "@refinedev/antd"
import { Form, Input, Switch } from "antd"
import { useNavigate } from "react-router-dom"
import { ImageUpload } from "../components/image-upload"

const HeroSlideForm = () => (
  <>
    <Form.Item label="Headline Line 1" name="headline_line1" rules={[{ required: true }]}>
      <Input placeholder="Jewels that Whisper" />
    </Form.Item>
    <Form.Item label="Headline Line 2" name="headline_line2" rules={[{ required: true }]}>
      <Input placeholder="Your Story." />
    </Form.Item>
    <Form.Item label="Accent Text" name="accent_text" extra="Small text above the headline (e.g. 'Minimal & Memorable')">
      <Input placeholder="Minimal & Memorable" />
    </Form.Item>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      <Form.Item label="CTA Label" name="cta_label" rules={[{ required: true }]}>
        <Input placeholder="Shop Collection" />
      </Form.Item>
      <Form.Item label="CTA Link" name="cta_href" rules={[{ required: true }]}>
        <Input placeholder="/store" />
      </Form.Item>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      <Form.Item label="Secondary CTA Label" name="cta_secondary_label">
        <Input placeholder="Our Story" />
      </Form.Item>
      <Form.Item label="Secondary CTA Link" name="cta_secondary_href">
        <Input placeholder="/about" />
      </Form.Item>
    </div>
    <Form.Item label="Background Image" name="image_url" rules={[{ required: true, message: "Background image is required" }]}>
      <ImageUpload
        folder="hero"
        aspectHint="Recommended: 1920×1080px, 16:9 ratio. Full-width hero background."
        required
      />
    </Form.Item>
    <Form.Item label="Active" name="is_active" valuePropName="checked" initialValue={true}>
      <Switch />
    </Form.Item>
  </>
)

export const HeroSlideCreate = () => {
  const navigate = useNavigate()
  const { formProps, saveButtonProps } = useForm({
    redirect: false,
    onMutationSuccess: () => navigate("/homepage"),
  })
  return (
    <Create saveButtonProps={saveButtonProps}>
      <Form {...formProps} layout="vertical">
        <HeroSlideForm />
      </Form>
    </Create>
  )
}

export const HeroSlideEdit = () => {
  const navigate = useNavigate()
  const { formProps, saveButtonProps } = useForm({
    redirect: false,
    onMutationSuccess: () => navigate("/homepage"),
  })
  return (
    <Edit saveButtonProps={saveButtonProps}>
      <Form {...formProps} layout="vertical">
        <HeroSlideForm />
      </Form>
    </Edit>
  )
}
