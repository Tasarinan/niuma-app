import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ListEditor } from '@/components/editors/ListEditor';
import { INPUT_LIMITS } from '@/config';

describe('ListEditor component', () => {
  it('should render with empty items', () => {
    const mockSave = vi.fn();
    render(<ListEditor items={[]} onSave={mockSave} />);

    expect(screen.getByText('No items yet')).toBeInTheDocument();
  });

  it('should render existing items', () => {
    const mockSave = vi.fn();
    const items = ['Item 1', 'Item 2', 'Item 3'];
    render(<ListEditor items={items} onSave={mockSave} />);

    items.forEach((item) => {
      expect(screen.getByDisplayValue(item)).toBeInTheDocument();
    });
  });

  it('should have maxLength attribute on input fields', () => {
    const mockSave = vi.fn();
    const items = ['Test item'];
    render(<ListEditor items={items} onSave={mockSave} />);

    // Get all input elements
    const inputs = screen.getAllByRole('textbox');

    // Each input should have maxLength
    inputs.forEach((input) => {
      expect(input).toHaveAttribute('maxLength', String(INPUT_LIMITS.MAX_LIST_ITEM_LENGTH));
    });
  });

  it('should allow adding new items', () => {
    const mockSave = vi.fn();
    render(<ListEditor items={[]} onSave={mockSave} placeholder="Add item..." />);

    const input = screen.getByPlaceholderText('Add item...');
    fireEvent.change(input, { target: { value: 'New item' } });

    // Click add button
    const addButton = screen.getByRole('button', { name: /add item/i });
    fireEvent.click(addButton);

    // Item should appear in the list
    expect(screen.getByDisplayValue('New item')).toBeInTheDocument();
  });

  it('should not add empty items', () => {
    const mockSave = vi.fn();
    render(<ListEditor items={[]} onSave={mockSave} placeholder="Add item..." />);

    const input = screen.getByPlaceholderText('Add item...');
    fireEvent.change(input, { target: { value: '' } });

    // Add button should be disabled for empty input
    const addButton = screen.getByRole('button', { name: /add item/i });
    expect(addButton).toBeDisabled();
  });

  it('should remove items', () => {
    const mockSave = vi.fn();
    const items = ['Item to remove'];
    render(<ListEditor items={items} onSave={mockSave} />);

    // Find and click remove button
    const removeButton = screen.getByRole('button', { name: /remove item/i });
    fireEvent.click(removeButton);

    // Item should be removed
    expect(screen.queryByDisplayValue('Item to remove')).not.toBeInTheDocument();
  });

  it('should track changes and enable save button', () => {
    const mockSave = vi.fn();
    const items = ['Original item'];
    render(<ListEditor items={items} onSave={mockSave} />);

    // Save button should be disabled initially (no changes)
    const saveButton = screen.getByRole('button', { name: /save changes/i });
    expect(saveButton).toBeDisabled();

    // Modify an item
    const input = screen.getByDisplayValue('Original item');
    fireEvent.change(input, { target: { value: 'Modified item' } });

    // Save button should now be enabled
    expect(saveButton).not.toBeDisabled();
  });

  it('should call onSave with filtered items', async () => {
    const mockSave = vi.fn();
    const items = ['Item 1'];
    render(<ListEditor items={items} onSave={mockSave} />);

    // Modify item
    const input = screen.getByDisplayValue('Item 1');
    fireEvent.change(input, { target: { value: 'Modified' } });

    // Click save
    const saveButton = screen.getByRole('button', { name: /save changes/i });
    fireEvent.click(saveButton);

    expect(mockSave).toHaveBeenCalledWith(['Modified']);
  });

  it('should call onCancel when cancel button is clicked', () => {
    const mockSave = vi.fn();
    const mockCancel = vi.fn();
    const items = ['Item 1'];
    render(<ListEditor items={items} onSave={mockSave} onCancel={mockCancel} />);

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelButton);

    expect(mockCancel).toHaveBeenCalled();
  });

  it('should reset to original items on cancel', () => {
    const mockSave = vi.fn();
    const mockCancel = vi.fn();
    const items = ['Original'];
    render(<ListEditor items={items} onSave={mockSave} onCancel={mockCancel} />);

    // Modify item
    const input = screen.getByDisplayValue('Original');
    fireEvent.change(input, { target: { value: 'Modified' } });

    // Cancel
    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelButton);

    // Should reset to original
    expect(screen.getByDisplayValue('Original')).toBeInTheDocument();
  });

  it('should respect maxItems limit', () => {
    const mockSave = vi.fn();
    const items = ['Item 1', 'Item 2'];
    render(<ListEditor items={items} onSave={mockSave} maxItems={2} />);

    // Should not show add input when at max
    expect(screen.queryByPlaceholderText('Add item...')).not.toBeInTheDocument();
  });

  it('should show add input when under maxItems', () => {
    const mockSave = vi.fn();
    const items = ['Item 1'];
    render(<ListEditor items={items} onSave={mockSave} maxItems={2} placeholder="Add item..." />);

    // Should show add input
    expect(screen.getByPlaceholderText('Add item...')).toBeInTheDocument();
  });

  it('should handle Enter key to add item', () => {
    const mockSave = vi.fn();
    render(<ListEditor items={[]} onSave={mockSave} placeholder="Add item..." />);

    const input = screen.getByPlaceholderText('Add item...');
    fireEvent.change(input, { target: { value: 'New item' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    // Item should be added
    expect(screen.getByDisplayValue('New item')).toBeInTheDocument();
  });

  it('should use custom empty message', () => {
    const mockSave = vi.fn();
    render(
      <ListEditor
        items={[]}
        onSave={mockSave}
        emptyMessage="No goals defined"
      />
    );

    expect(screen.getByText('No goals defined')).toBeInTheDocument();
  });
});
