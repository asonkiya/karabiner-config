-- Scratchpad nvim overlay, loaded only by the iTerm "Scratchpad" hotkey
-- window (see scratchpad.json). Layers ephemeral-scratchpad behavior on top
-- of the normal nvim config; the main nvim setup is unaffected.

local IDLE_CLEAR_SECS = 5 * 60 -- wipe content after this much inactivity

-- Window title: Hammerspoon's scratchCenter() finds the window by this.
vim.opt.title = true
vim.opt.titlestring = "Scratchpad"

-- Throwaway buffer: no lint/style noise. Kill displayed diagnostics, spell
-- squiggles, and (if nvim-lint is installed) linting subprocesses entirely.
vim.diagnostic.enable(false)
vim.opt.spell = false
pcall(function()
        require("lint").linters_by_ft = {}
end)

local aug = vim.api.nvim_create_augroup("Scratchpad", { clear = true })

-- Autosave when the window loses focus (it auto-hides on focus loss).
vim.api.nvim_create_autocmd("FocusLost", {
        group = aug,
        callback = function()
                vim.cmd("silent! wa")
        end,
})

local function clearScratch()
        vim.api.nvim_buf_set_lines(0, 0, -1, false, {})
        vim.cmd("silent! write")
end

-- Start fresh: whatever the file held last session is stale by definition.
vim.api.nvim_create_autocmd("VimEnter", { group = aug, callback = clearScratch })

-- Idle wipe: any interaction resets the clock; after IDLE_CLEAR_SECS of
-- nothing, clear the buffer. Runs even while the window is hidden, since the
-- nvim session persists across toggles.
local lastActivity = vim.uv.now()
vim.api.nvim_create_autocmd(
        { "CursorMoved", "CursorMovedI", "TextChanged", "TextChangedI", "InsertEnter", "FocusGained", "BufEnter" },
        {
                group = aug,
                callback = function()
                        lastActivity = vim.uv.now()
                end,
        }
)

local timer = vim.uv.new_timer()
timer:start(
        30000,
        30000,
        vim.schedule_wrap(function()
                if vim.uv.now() - lastActivity < IDLE_CLEAR_SECS * 1000 then
                        return
                end
                local lines = vim.api.nvim_buf_get_lines(0, 0, -1, false)
                if #lines == 1 and lines[1] == "" then
                        return -- already empty
                end
                clearScratch()
                lastActivity = vim.uv.now()
        end)
)
