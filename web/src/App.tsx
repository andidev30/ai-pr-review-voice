import { useState } from 'react'
import './App.css'

type Screen = 'upload' | 'review'

function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('upload')

  const handleSubmit = () => {
    // Navigate to review screen (functionality will be added later)
    setCurrentScreen('review')
  }

  const handleBack = () => {
    setCurrentScreen('upload')
  }

  return (
    <div className="app-container">
      {currentScreen === 'upload' ? (
        <UploadScreen onSubmit={handleSubmit} />
      ) : (
        <ReviewScreen onBack={handleBack} />
      )}
    </div>
  )
}

// Screen 1: Upload Screen
function UploadScreen({ onSubmit }: { onSubmit: () => void }) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [prUrl, setPrUrl] = useState('')

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
    }
  }

  const handleRemoveFile = () => {
    setSelectedFile(null)
    // Reset the file input
    const fileInput = document.getElementById('requirement-file') as HTMLInputElement
    if (fileInput) fileInput.value = ''
  }

  const isSubmitDisabled = !prUrl.trim()

  return (
    <div className="screen upload-screen">
      <div className="screen-content">
        <h1 className="screen-title">AI PR Review</h1>

        <div className="upload-form">
          {/* Requirement Document Upload */}
          <div className="form-group">
            <label className="form-label">Requirement Document <span className="optional-tag">(optional)</span></label>
            <div className="file-dropzone">
              <input
                type="file"
                id="requirement-file"
                className="file-input"
                accept=".pdf,.md,.txt,.doc,.docx"
                onChange={handleFileChange}
              />
              {!selectedFile ? (
                <label htmlFor="requirement-file" className="dropzone-content">
                  <div className="dropzone-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="12" x2="12" y1="18" y2="12" />
                      <line x1="9" x2="15" y1="15" y2="15" />
                    </svg>
                  </div>
                  <span className="dropzone-text">Drop file here or click to upload</span>
                  <span className="dropzone-subtext">Supports: PDF, Markdown, TXT, DOC</span>
                </label>
              ) : (
                <div className="file-selected">
                  <div className="file-info">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                    <span className="file-name">{selectedFile.name}</span>
                    <span className="file-size">({(selectedFile.size / 1024).toFixed(1)} KB)</span>
                  </div>
                  <button type="button" className="remove-file-btn" onClick={handleRemoveFile}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" x2="6" y1="6" y2="18" />
                      <line x1="6" x2="18" y1="6" y2="18" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* GitHub PR URL Input */}
          <div className="form-group">
            <label className="form-label">URL Github Pull Request <span className="required-tag">*</span></label>
            <input
              type="text"
              className="url-input"
              placeholder="https://github.com/owner/repo/pull/123"
              value={prUrl}
              onChange={(e) => setPrUrl(e.target.value)}
            />
          </div>

          <button
            className="submit-btn"
            onClick={onSubmit}
            disabled={isSubmitDisabled}
          >
            <span>SUBMIT</span>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

// Screen 2: Review Screen
function ReviewScreen({ onBack }: { onBack: () => void }) {
  const [isMicActive, setIsMicActive] = useState(false)

  // Mock findings data for UI display
  const mockFindings = [
    { id: 'F1', status: 'FAIL', summary: 'Missing input validation for user email' },
    { id: 'F2', status: 'PASS', summary: 'Authentication flow implemented correctly' },
    { id: 'F3', status: 'CLARIFY', summary: 'Unclear if pagination is required' },
  ]

  return (
    <div className="screen review-screen">
      <div className="screen-content">
        {/* Header */}
        <div className="review-header">
          <button className="back-btn" onClick={onBack}>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m12 19-7-7 7-7" />
              <path d="M19 12H5" />
            </svg>
          </button>
          <h1 className="screen-title">AI PR Review</h1>
          <button
            className={`mic-btn ${isMicActive ? 'active' : ''}`}
            onClick={() => setIsMicActive(!isMicActive)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" x2="12" y1="19" y2="22" />
            </svg>
          </button>
        </div>

        {/* Voice Output Section */}
        <div className="voice-output-section">
          <div className="speaker-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
            </svg>
          </div>
          <div className="voice-text">
            <p>Oke, saya menemukan beberapa findings. Di file <strong>index.js line 531</strong>, ada function yang perlu di-review terkait validasi input...</p>
          </div>
          <button className="play-btn">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="6 3 20 12 6 21 6 3" />
            </svg>
          </button>
        </div>

        {/* Main Content: Findings + Diff Viewer */}
        <div className="review-main">
          {/* Findings Panel */}
          <div className="findings-panel">
            <h3 className="panel-subtitle">Findings</h3>
            <div className="findings-list">
              {mockFindings.map((finding) => (
                <div key={finding.id} className={`finding-item finding-${finding.status.toLowerCase()}`}>
                  <div className="finding-header">
                    <span className={`finding-status status-${finding.status.toLowerCase()}`}>
                      {finding.status}
                    </span>
                    <span className="finding-id">{finding.id}</span>
                  </div>
                  <p className="finding-summary">{finding.summary}</p>
                  <div className="finding-actions">
                    <button className="action-btn approve">Approve</button>
                    <button className="action-btn dismiss">Dismiss</button>
                    <button className="action-btn edit">Edit</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Diff Viewer Panel */}
          <div className="diff-panel">
            <h3 className="panel-subtitle">Diff Viewer</h3>
            <div className="diff-viewer">
              <div className="diff-file-header">
                <span className="diff-filename">src/index.js</span>
              </div>
              <div className="diff-content">
                <div className="diff-line diff-context">
                  <span className="line-number">529</span>
                  <span className="line-content">  const handleSubmit = async () =&gt; {'{'}</span>
                </div>
                <div className="diff-line diff-context">
                  <span className="line-number">530</span>
                  <span className="line-content">    const email = inputRef.current.value;</span>
                </div>
                <div className="diff-line diff-deletion">
                  <span className="line-number">531</span>
                  <span className="line-content">-   await submitForm(email);</span>
                </div>
                <div className="diff-line diff-addition highlight">
                  <span className="line-number">531</span>
                  <span className="line-content">+   if (!validateEmail(email)) return;</span>
                </div>
                <div className="diff-line diff-addition">
                  <span className="line-number">532</span>
                  <span className="line-content">+   await submitForm(email);</span>
                </div>
                <div className="diff-line diff-context">
                  <span className="line-number">533</span>
                  <span className="line-content">  {'}'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Draft Comment Section */}
        <div className="draft-comment-section">
          <h3 className="panel-subtitle">Draft GitHub Comment</h3>
          <div className="draft-content">
            <textarea
              className="draft-textarea"
              defaultValue={`## PR Review Summary

### ❌ FAIL: Missing input validation
- File: src/index.js (line 531)
- Suggestion: Add email validation before form submission

### ✅ PASS: Authentication flow
- Implemented correctly per requirements`}
              rows={6}
            />
            <div className="draft-actions">
              <button className="copy-btn">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                  <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                </svg>
                Copy Comment
              </button>
              <button className="post-btn" disabled>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
                  <path d="M9 18c-4.51 2-5-2-7-2" />
                </svg>
                Post to GitHub
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
