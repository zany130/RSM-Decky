import { ButtonItem, ModalRoot, PanelSection, PanelSectionRow, TextField } from "@decky/ui";
import { useState } from "react";
import { toErrorDetails } from "../../utils/errorDetails";

type AddRepositoryForm = {
  repoId: string;
  displayName: string;
  gitUrl: string;
  author: string;
  description: string;
};

type AddRepositoryModalProps = {
  closeModal?: () => void;
  onSubmit: (form: AddRepositoryForm) => Promise<void>;
};

const AddRepositoryModal = ({ closeModal, onSubmit }: AddRepositoryModalProps) => {
  const [repoId, setRepoId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [gitUrl, setGitUrl] = useState("");
  const [author, setAuthor] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const canSubmit = repoId.trim().length > 0 && displayName.trim().length > 0 && gitUrl.trim().length > 0;

  const submit = async () => {
    if (!canSubmit || busy) {
      return;
    }
    setBusy(true);
    setErrorText(null);
    try {
      await onSubmit({
        repoId,
        displayName,
        gitUrl,
        author,
        description,
      });
      closeModal?.();
    } catch (e: unknown) {
      setErrorText(toErrorDetails(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalRoot closeModal={closeModal}>
      <PanelSection title="Add Repository">
        <PanelSectionRow>
          <TextField
            label="Repository ID"
            description="Lowercase id (letters/numbers/_/-). Example: nice-shaders"
            value={repoId}
            disabled={busy}
            onChange={(ev) => setRepoId(ev.target.value)}
          />
        </PanelSectionRow>
        <PanelSectionRow>
          <TextField
            label="Display Name"
            value={displayName}
            disabled={busy}
            onChange={(ev) => setDisplayName(ev.target.value)}
          />
        </PanelSectionRow>
        <PanelSectionRow>
          <TextField
            label="Git URL"
            value={gitUrl}
            disabled={busy}
            onChange={(ev) => setGitUrl(ev.target.value)}
          />
        </PanelSectionRow>
        <PanelSectionRow>
          <TextField
            label="Author (optional)"
            value={author}
            disabled={busy}
            onChange={(ev) => setAuthor(ev.target.value)}
          />
        </PanelSectionRow>
        <PanelSectionRow>
          <TextField
            label="Description (optional)"
            value={description}
            disabled={busy}
            onChange={(ev) => setDescription(ev.target.value)}
          />
        </PanelSectionRow>
        {errorText && (
          <PanelSectionRow>
            <div style={{ color: "salmon", fontSize: "12px", whiteSpace: "pre-wrap" }}>{errorText}</div>
          </PanelSectionRow>
        )}
        <PanelSectionRow>
          <ButtonItem layout="below" disabled={busy || !canSubmit} onClick={submit}>
            {busy ? "Adding..." : "Add Repository"}
          </ButtonItem>
        </PanelSectionRow>
        <PanelSectionRow>
          <ButtonItem layout="below" disabled={busy} onClick={() => closeModal?.()}>
            Cancel
          </ButtonItem>
        </PanelSectionRow>
      </PanelSection>
    </ModalRoot>
  );
};

export default AddRepositoryModal;
