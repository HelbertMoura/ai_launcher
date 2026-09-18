//! Typed application error for Tauri commands.
//!
//! `AppError` serializes to a **plain string** (its `Display` message), so the
//! frontend contract is unchanged: command rejections keep arriving in JS as a
//! `string` (see `src/lib/tauri.ts` and the `catch (e) => String(e)` handlers).
//! Adoption started with the commands touched by the L1 hygiene wave; the
//! remaining `Result<_, String>` commands migrate in a later wave.

use serde::Serialize;
use thiserror::Error;

/// Typed error surfaced by Tauri commands.
#[derive(Debug, Error)]
pub enum AppError {
    /// Free-form message. Carries the legacy `Result<_, String>` payloads
    /// verbatim so migrating a command never rewrites its error text.
    #[error("{0}")]
    Message(String),
    /// Filesystem / process-spawn I/O failure.
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
}

impl AppError {
    /// Builds an error from any string-like message.
    pub fn new(msg: impl Into<String>) -> Self {
        Self::Message(msg.into())
    }
}

impl From<String> for AppError {
    fn from(s: String) -> Self {
        Self::Message(s)
    }
}

impl From<&str> for AppError {
    fn from(s: &str) -> Self {
        Self::Message(s.to_string())
    }
}

/// Serializes to the `Display` message as a JSON string, keeping the JS-side
/// error type a plain `string`.
impl Serialize for AppError {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&self.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn display_uses_message_verbatim() {
        assert_eq!(AppError::new("boom").to_string(), "boom");
        assert_eq!(AppError::from(String::from("boom")).to_string(), "boom");
        assert_eq!(AppError::from("boom").to_string(), "boom");
    }

    #[test]
    fn serializes_as_plain_string() {
        let err = AppError::new("falha ao ler arquivo");
        let json = serde_json::to_value(&err).expect("serialize AppError");
        assert_eq!(
            json,
            serde_json::Value::String("falha ao ler arquivo".into())
        );
    }

    #[test]
    fn from_io_error_prefixes_context() {
        let io_err = std::io::Error::new(std::io::ErrorKind::NotFound, "no such file");
        let err: AppError = io_err.into();
        assert_eq!(err.to_string(), "io error: no such file");
    }
}
