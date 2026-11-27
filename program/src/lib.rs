//! SolGuard check-log program.
//!
//! Instruction data layout:
//!   byte 0      : risk level (0 = Aman/safe, 1 = Hati-hati/caution, 2 = Bahaya/danger)
//!   bytes 1..33 : first 32 bytes of the checked transaction's signature
//!                 (a compact reference to what was checked)
//!
//! Accounts:
//!   [0] the checker — must sign. Anyone can log their own checks.
//!
//! The program stores nothing; it emits the record as a program log line,
//! permanently indexed with the invoking transaction. That is the whole
//! point: a public, tamper-evident trail that "this signature was checked
//! at this slot with this verdict" — the on-chain half of SolGuard.

use solana_program::{
    account_info::AccountInfo,
    entrypoint,
    entrypoint::ProgramResult,
    msg,
    program_error::ProgramError,
    pubkey::Pubkey,
};

entrypoint!(process_instruction);

pub fn process_instruction(
    _program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    let checker = accounts
        .first()
        .ok_or(ProgramError::NotEnoughAccountKeys)?;
    if !checker.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }
    if instruction_data.len() < 33 {
        return Err(ProgramError::InvalidInstructionData);
    }
    let risk = instruction_data[0];
    if risk > 2 {
        return Err(ProgramError::InvalidInstructionData);
    }
    let risk_label = match risk {
        0 => "AMAN",
        1 => "HATI-HATI",
        _ => "BAHAYA",
    };
    let reference = &instruction_data[1..33];
    msg!(
        "SOLGUARD CHECK risk={} ref={}",
        risk_label,
        hex_encode(reference)
    );
    Ok(())
}

fn hex_encode(bytes: &[u8]) -> String {
    let mut s = String::with_capacity(bytes.len() * 2);
    for b in bytes {
        s.push_str(&format!("{:02x}", b));
    }
    s
}
